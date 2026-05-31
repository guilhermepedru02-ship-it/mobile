import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import MiniSearch from 'minisearch';

const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';
const RAG_DIR        = path.join(WORKSPACE_ROOT, 'Cerebro/Memoria-RAG');
const PREFS_PATH     = path.join(WORKSPACE_ROOT, 'Cerebro/02_Memoria/preferencias_usuario.md');
const CACHE_PATH     = path.join(WORKSPACE_ROOT, 'Cerebro', '.vector_cache.json');

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
// DESIGN PRINCIPLE: Qwen 0.5B não mantém personas abstratas.
// Funciona muito melhor com TEMPLATES DE OUTPUT — instrucoes
// explícitas de COMO FORMATAR a resposta, não de "quem ser".
// Toda instrução aqui é comportamental e literal, não semântica.
// ============================================================

function buildSystemPrompt(healthInfo, userProfile) {
    return (
        `IDENTIDADE: Voce e CHRONOS LOCAL — guardiao soberano do Workspace Mobile de Guilherme Moreno.\n` +
        `Motor: llama-server | Modelo: Qwen 2.5 0.5B Q4_K_M | ${healthInfo}\n` +
        `Guilherme: ${userProfile}\n` +
        `\n` +
        `FORMATO OBRIGATORIO — siga isso SEMPRE:\n` +
        `- Comece TODA resposta com "Chronos:" (nunca omita isso)\n` +
        `- Maximo 3 frases. Direto, tecnico, sem enrolacao.\n` +
        `- NUNCA diga "Ola", "Como posso ajudar" ou "Claro!". Isso e proibido.\n` +
        `- Se perguntarem seu nome: "Chronos Local, guardiao do Workspace de Guilherme."\n` +
        `- Se perguntarem sua saude: reporte exatamente "${healthInfo}"\n` +
        `- Se nao souber algo: "Chronos: Nao tenho esse dado agora. Tente /diagnostico ou /status."\n` +
        `- NUNCA gere JSON. NUNCA invente dados. Sempre em portugues.`
    );
}

function buildSynthesisPrompt(healthInfo, toolId, toolOutput) {
    // Handler especial para list_tools: instrui formatacao de lista limpa
    if (toolId === 'list_tools') {
        return (
            `IDENTIDADE: Voce e CHRONOS LOCAL. ${healthInfo}\n` +
            `Abaixo esta a lista EXATA das suas ferramentas (output real do sistema).\n` +
            `Apresente comeando com "Chronos — ferramentas disponíveis:" e liste de forma organizada.\n` +
            `NAO invente ferramentas. NAO adicione itens. Apenas formate o que esta abaixo.\n` +
            `OUTPUT:\n${toolOutput || '(lista indisponivel)'}`
        );
    }
    // Handler geral: Chronos [tool_id]: resultado claro
    return (
        `IDENTIDADE: Voce e CHRONOS LOCAL. ${healthInfo}\n` +
        `A ferramenta "${toolId}" executou e retornou os dados abaixo.\n` +
        `Apresente o resultado comeando com "Chronos [${toolId}]:" de forma clara e objetiva.\n` +
        `Nao invente nada. Nao gere JSON. Maximo 4 frases em portugues.\n` +
        `RESULTADO DA FERRAMENTA:\n${(toolOutput || '(sem output)').slice(0, 450)}`
    );
}

// ============================================================
// BUSCA SEMANTICA (MiniSearch) — com filtro de blacklist
// ============================================================
function semanticSearch(query, topK = 2) {
    if (!fs.existsSync(CACHE_PATH)) return null;
    try {
        const indexJson  = fs.readFileSync(CACHE_PATH, 'utf8');
        const miniSearch = MiniSearch.loadJSON(indexJson, {
            fields: ['text'],
            storeFields: ['file', 'text']
        });
        const results = miniSearch.search(query, { fuzzy: 0.2, prefix: true });
        return results
            .filter(r => !isRAGBlacklisted(r.file))
            .slice(0, topK)
            .map(r => ({ file: r.file, excerpt: r.text.slice(0, 200) }));
    } catch { return null; }
}

// RAG recente — fallback quando sem índice semântico
// Somente .md datados (YYYY-MM-DD_*), sem wm_*.json
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
        const mdPattern = /^\d{4}-\d{2}-\d{2}_(?!wm_).*\.md$/;
        const files = fs.readdirSync(RAG_DIR)
            .filter(f => mdPattern.test(f))
            .sort()
            .slice(-n);
        return files.map(f => {
            const content = fs.readFileSync(path.join(RAG_DIR, f), 'utf8');
            return `[${f}]\n${semanticChunking(content, 280)}`;
        }).join('\n---\n');
    } catch { return ''; }
}

function loadWorkingMemory() {
    const wmPath = path.join(WORKSPACE_ROOT, 'Cerebro/02_Memoria/working_memory_active.json');
    if (!fs.existsSync(wmPath)) return '';
    try {
        const wm = JSON.parse(fs.readFileSync(wmPath, 'utf8'));
        return `Tarefa ativa: "${wm.task_description.slice(0, 80)}"`;
    } catch { return ''; }
}

// RAG CONTEXT BUILDER
function buildRAGContext(userPrompt) {
    const semantic = semanticSearch(userPrompt, 2);
    if (semantic && semantic.length > 0) {
        return semantic.map(r => `[${path.basename(r.file)}]\n${r.excerpt}`).join('\n---\n');
    }
    return loadRecentRAG(1);
}

// ============================================================
// EXPORT PRINCIPAL
// ============================================================
export function buildContext(userPrompt, tool = null, toolOutput = null) {
    const healthInfo  = getSystemHealth();
    const userProfile = loadUserProfile();

    // Modo síntese: system prompt JA contém o output da ferramenta
    if (tool && toolOutput) {
        return {
            system: buildSynthesisPrompt(healthInfo, tool.id, toolOutput),
            prompt: userPrompt
        };
    }

    // Ferramenta identificada mas output ainda não disponível
    if (tool && !toolOutput) {
        return {
            system: buildSystemPrompt(healthInfo, userProfile),
            prompt: `${userPrompt}\n[CTX]Ferramenta selecionada: ${tool.id} | ${tool.description}[/CTX]`
        };
    }

    // Modo conversacional — RAG filtrado (sem instruções operacionais)
    const ragContext = buildRAGContext(userPrompt);
    const wmContext  = loadWorkingMemory();
    const contextParts = [ragContext, wmContext].filter(Boolean);
    const contextBlock = contextParts.length
        ? `\n[CTX]${contextParts.join(' | ').slice(0, 350)}[/CTX]`
        : '';

    return {
        system: buildSystemPrompt(healthInfo, userProfile),
        prompt: `${userPrompt}${contextBlock}`
    };
}
