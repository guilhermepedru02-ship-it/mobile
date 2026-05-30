import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';
const RAG_DIR        = path.join(WORKSPACE_ROOT, 'Cerebro/Memoria-RAG');
const PREFS_PATH     = path.join(WORKSPACE_ROOT, 'Cerebro/02_Memoria/preferencias_usuario.md');

// ============================================================
// SAÚDE DO SISTEMA — compacto (máx ~80 chars)
// ============================================================
function getSystemHealth() {
    try {
        const ram = execSync('free -h 2>/dev/null | grep Mem', { timeout: 2000 }).toString().trim();
        const p   = ram.split(/\s+/);
        const llm = (() => {
            try { execSync('curl -s --max-time 1 http://127.0.0.1:11434/health', { timeout: 2000 }); return 'OK'; }
            catch { return 'OFF'; }
        })();
        return `RAM ${p[2]}/${p[1]} (dispon: ${p[6]}) | llama: ${llm}`;
    } catch { return 'saúde: indisponível'; }
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
        return bullets || 'Guilherme: dev minimalista, soberania, sem lixo eletronico.';
    } catch { return 'Guilherme: dev minimalista, soberania, sem lixo eletronico.'; }
}

// ============================================================
// SYSTEM PROMPTS — enxutos para caber no ctx-size 1024
// ============================================================
function buildSystemPrompt(healthInfo, userProfile) {
    return `Voce e o CHRONOS LOCAL, IA soberana do Workspace Mobile Android de Guilherme Moreno.
Motor: llama-server | Modelo: Qwen 2.5 0.5B Q4_K_M | Velocidade alvo: 12 tok/s
Saúde atual: ${healthInfo}
Sobre o Guilherme: ${userProfile}
Sempre responda em portugues direto. Nao gere JSON. Seu nome e Chronos Local.`;
}

function buildSynthesisPrompt(healthInfo) {
    return `Voce e o CHRONOS LOCAL. Saúde: ${healthInfo}
Resuma o resultado da ferramenta em portugues claro e direto para Guilherme. Nao gere JSON.`;
}

// ============================================================
// RAG — apenas arquivos datados (YYYY-MM-DD_*), 1 nota
// ============================================================
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
        // Filtra apenas arquivos com padrão de data YYYY-MM-DD no nome
        const datePattern = /^\d{4}-\d{2}-\d{2}_.*\.md$/;
        const files = fs.readdirSync(RAG_DIR)
            .filter(f => datePattern.test(f))
            .sort()       // ordena por data (prefixo YYYY-MM-DD garante ordem correta)
            .slice(-n);   // pega os mais recentes
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
        return `Tarefa ativa: "${wm.task_description.slice(0,80)}"`.trim();
    } catch { return ''; }
}

// ============================================================
// EXPORT PRINCIPAL
// ============================================================
export function buildContext(userPrompt, tool = null) {
    const healthInfo  = getSystemHealth();
    const userProfile = loadUserProfile();
    const ragContext  = tool ? '' : loadRecentRAG(1);
    const wmContext   = loadWorkingMemory();
    const toolContext = tool ? `Ferramenta: ${tool.id} | ${tool.description}` : '';

    const contextParts = [ragContext, wmContext, toolContext].filter(Boolean);
    const contextBlock = contextParts.length
        ? `\n[CTX]${contextParts.join(' | ')}[/CTX]`
        : '';

    return {
        system: tool
            ? buildSynthesisPrompt(healthInfo)
            : buildSystemPrompt(healthInfo, userProfile),
        prompt: `${userPrompt}${contextBlock}`
    };
}
