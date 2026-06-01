import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { search as vectorSearch } from './vector_db_v2.js';

const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';
const RAG_DIR        = path.join(WORKSPACE_ROOT, 'Cerebro/Memoria-RAG');
const PREFS_PATH     = path.join(WORKSPACE_ROOT, 'Cerebro/02_Memoria/preferencias_usuario.md');

// ============================================================
// RAG BLACKLIST — instruções operacionais nunca viram contexto
// ============================================================
const RAG_BLACKLIST = [
    'Cerebro/00_Sistema',
    'Cerebro/01_Planejamento',
];

function isRAGBlacklisted(filePath) {
    const rel = filePath.replace(WORKSPACE_ROOT + '/', '');
    return RAG_BLACKLIST.some(prefix => rel.startsWith(prefix));
}

// ============================================================
// SAÚDE DO SISTEMA — compacto (~80 chars)
// ============================================================
function getSystemHealth() {
    try {
        const ram = execSync('free -h 2>/dev/null | grep Mem', { timeout: 2000 }).toString().trim();
        const p   = ram.split(/\s+/);
        const llm = (() => {
            try { execSync('curl -s --max-time 1 http://127.0.0.1:11434/health', { timeout: 2000 }); return 'OK'; }
            catch { return 'OFF'; }
        })();
        return `RAM ${p[2]}/${p[1]} (livre: ${p[6]}) | llama: ${llm}`;
    } catch { return 'saude: indisponivel'; }
}

// ============================================================
// PERFIL DO USUÁRIO — bullet points compactos (~200 chars)
// ============================================================
function loadUserProfile() {
    try {
        const raw = fs.readFileSync(PREFS_PATH, 'utf8');
        const bullets = raw.split('\n')
            .filter(l => l.trim().startsWith('-'))
            .map(l => l.trim())
            .join(' | ')
            .slice(0, 220);
        return bullets || 'Guilherme: dev minimalista, soberania de dados, sem lixo eletronico.';
    } catch { return 'Guilherme: dev minimalista, soberania de dados, sem lixo eletronico.'; }
}

// ============================================================
// SYSTEM PROMPTS
// ------------------------------------------------------------
// DESIGN PRINCIPLE v2.2.0:
//   - Removidos marcadores [CTX]...[/CTX] — o Qwen 0.5B os reproduzia
//     literalmente nas respostas, gerando alucinacoes.
//   - Contexto RAG é injetado como texto plano após linha em branco,
//     com prefixo legivel (MEMORIA RECENTE:, FERRAMENTA:, etc.)
//   - O system prompt é mantido curto (<300 tokens) para não
//     esgotar a janela de contexto do modelo 0.5B.
// ============================================================

function buildSystemPrompt(healthInfo, userProfile) {
    return (
        `IDENTIDADE: Voce e CHRONOS LOCAL, assistente soberano do Workspace de Guilherme Moreno.\n` +
        `Motor: llama-server + Qwen 2.5 0.5B | ${healthInfo}\n` +
        `\n` +
        `REGRAS ABSOLUTAS:\n` +
        `1. Comece TODA resposta com "Chronos:" sem excecao.\n` +
        `2. Maximo 3 frases. Direto e tecnico.\n` +
        `3. NUNCA diga "Ola", "Como posso ajudar", "Claro!" ou similares.\n` +
        `4. NUNCA reproduza nomes de variaveis, caminhos de arquivo ou marcadores do sistema.\n` +
        `5. Se nao souber: responda exatamente "Chronos: Sem dados. Use /status ou /diagnostico."\n` +
        `6. Sempre em portugues. Nunca gere JSON bruto.`
    );
}

function buildSynthesisPrompt(healthInfo, toolId, toolOutput) {
    if (toolId === 'list_tools') {
        return (
            `IDENTIDADE: Voce e CHRONOS LOCAL. ${healthInfo}\n` +
            `\n` +
            `A seguir esta a lista completa de ferramentas do sistema.\n` +
            `Apresente comeando com "Chronos - ferramentas disponíveis:" e liste de forma organizada.\n` +
            `NAO invente ferramentas. Formate apenas o que esta abaixo.\n` +
            `\n` +
            `FERRAMENTAS:\n${toolOutput || '(lista indisponivel)'}`
        );
    }
    return (
        `IDENTIDADE: Voce e CHRONOS LOCAL. ${healthInfo}\n` +
        `\n` +
        `A ferramenta "${toolId}" executou com sucesso.\n` +
        `Apresente o resultado comeando com "Chronos [${toolId}]:" de forma clara e objetiva.\n` +
        `Maximo 4 frases em portugues. Nao invente nada. Nao gere JSON.\n` +
        `\n` +
        `RESULTADO:\n${(toolOutput || '(sem output)').slice(0, 500)}`
    );
}

// ============================================================
// BUSCA SEMANTICA v2 — vetorial com fallback keyword
// ============================================================
async function semanticSearch(query, topK = 2) {
    try {
        const res = await vectorSearch(query, topK + 2);
        if (!res.success || !res.results?.length) return null;
        return res.results
            .filter(r => !isRAGBlacklisted(r.file))
            .slice(0, topK)
            .map(r => ({ file: r.file, excerpt: r.excerpt ?? r.text?.slice(0, 200) ?? '', mode: res.mode }));
    } catch { return null; }
}

// RAG recente — fallback quando sem índice semântico
// Somente .md datados consolidados (YYYY-MM-DD_consolidated.md)
function semanticChunking(content, maxChars = 300) {
    if (!content) return '';
    const sections = content.split(/(?=^## )/m);
    let result = '', len = 0;
    for (const s of sections) {
        if (len + s.length <= maxChars) { result += s + '\n'; len += s.length; }
        else if (!result) { result = s.slice(0, maxChars) + '...'; break; }
        else break;
    }
    return result.trim();
}

function loadRecentRAG(n = 1) {
    try {
        // Prioriza arquivos consolidados, depois qualquer .md datado
        const consolidatedPattern = /^\d{4}-\d{2}-\d{2}_consolidated\.md$/;
        const mdPattern = /^\d{4}-\d{2}-\d{2}_(?!wm_).*\.md$/;

        const all = fs.readdirSync(RAG_DIR).sort();
        const files = [
            ...all.filter(f => consolidatedPattern.test(f)),
            ...all.filter(f => mdPattern.test(f) && !consolidatedPattern.test(f))
        ].slice(-n);

        return files.map(f => {
            const content = fs.readFileSync(path.join(RAG_DIR, f), 'utf8');
            return `MEMORIA [${f}]:\n${semanticChunking(content, 280)}`;
        }).join('\n---\n');
    } catch { return ''; }
}

function loadWorkingMemory() {
    const wmPath = path.join(WORKSPACE_ROOT, 'Cerebro/02_Memoria/working_memory_active.json');
    if (!fs.existsSync(wmPath)) return '';
    try {
        const wm = JSON.parse(fs.readFileSync(wmPath, 'utf8'));
        return `TAREFA ATIVA: "${wm.task_description.slice(0, 80)}"`;
    } catch { return ''; }
}

// RAG CONTEXT BUILDER
async function buildRAGContext(userPrompt) {
    const semantic = await semanticSearch(userPrompt, 2);
    if (semantic && semantic.length > 0) {
        return semantic
            .map(r => `MEMORIA [${path.basename(r.file)}]:\n${r.excerpt}`)
            .join('\n---\n');
    }
    return loadRecentRAG(1);
}

// ============================================================
// EXPORT PRINCIPAL
// ============================================================
export async function buildContext(userPrompt, tool = null, toolOutput = null) {
    const healthInfo  = getSystemHealth();
    const userProfile = loadUserProfile();

    // Modo síntese: system prompt ja contem o output da ferramenta
    if (tool && toolOutput) {
        return {
            system: buildSynthesisPrompt(healthInfo, tool.id, toolOutput),
            prompt: userPrompt
        };
    }

    // Ferramenta identificada mas output ainda nao disponivel
    if (tool && !toolOutput) {
        return {
            system: buildSystemPrompt(healthInfo, userProfile),
            prompt: `${userPrompt}\n\nFERRAMENTA SELECIONADA: ${tool.id}\nDESCRICAO: ${tool.description}`
        };
    }

    // Modo conversacional — RAG filtrado (sem instrucoes operacionais)
    const ragContext = await buildRAGContext(userPrompt);
    const wmContext  = loadWorkingMemory();

    const contextParts = [ragContext, wmContext].filter(Boolean);
    // Contexto como texto plano após linha em branco — sem tags XML
    const contextBlock = contextParts.length
        ? `\n\n${contextParts.join('\n').slice(0, 400)}`
        : '';

    return {
        system: buildSystemPrompt(healthInfo, userProfile),
        prompt: `${userPrompt}${contextBlock}`
    };
}
