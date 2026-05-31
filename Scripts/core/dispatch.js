import fs from 'fs';
import path from 'path';

const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';
const REGISTRY_PATH  = path.join(WORKSPACE_ROOT, 'Scripts/core/tool_registry.json');

// ============================================================
// INTENTS
// ============================================================
export const INTENT = {
    TOOL_CALL:       'TOOL_CALL',
    CODE_TASK:       'CODE_TASK',
    KNOWLEDGE_QUERY: 'KNOWLEDGE_QUERY',
    MEMORY_WRITE:    'MEMORY_WRITE',
    CREATIVE_TASK:   'CREATIVE_TASK'
};

// Palavras-chave de fallback por intent (quando nenhuma ferramenta casa)
const INTENT_KEYWORDS = {
    [INTENT.CODE_TASK]:       ['cria', 'crie', 'codifica', 'programa', 'script', 'instala', 'npm', 'git commit', 'refatora'],
    [INTENT.KNOWLEDGE_QUERY]: ['o que e', 'explica', 'como funciona', 'qual', 'por que', 'diferenca entre', 'busca', 'entende', 'sabe', 'me conta', 'me diz', 'me explica', 'o sistema', 'o que voce', 'voce sabe'],
    [INTENT.MEMORY_WRITE]:    ['lembre', 'registra', 'anota', 'memoriza', 'salva isso', 'guarda'],
    [INTENT.CREATIVE_TASK]:   ['escreve', 'redige', 'gera texto', 'cria um texto', 'componha']
};

// ============================================================
// NORMALIZAÇÃO UNICODE
// Remove diacríticos — "diagnóstico" casa com "diagnostico"
// ============================================================
function normalize(str) {
    return str
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();
}

// ============================================================
// REGISTRY
// ============================================================
function loadRegistry() {
    try   { return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); }
    catch { return { tools: [] }; }
}

function resolveDate(str) {
    const date = new Date().toISOString().slice(0, 10);
    return str.replace(/__DATE__/g, date);
}

// ============================================================
// MATCH DE KEYWORD — v2.1.0
// ============================================================
// Problema anterior: regex (^|[\s,!?])kw([\s,!?]|$) falhava quando:
//   - prompt era exatamente a keyword (ex: "ram" → $ não batia)
//   - keyword multi-palavra com espaços internos
//   - boundary chars \s não incluíam todos os separadores reais
//
// Solução: substituímos o regex de boundary por três verificações
// ordenadas por custo, sem regex complexo:
//   1. Exact match (prompt normalizado === keyword normalizada)
//   2. Substring com boundaries simples: espaços ao redor ou bordas
//   3. includes() direto para keywords multi-palavra (>1 token)
// ============================================================
function keywordMatches(normalizedPrompt, normalizedKeyword) {
    const p = normalizedPrompt;
    const k = normalizedKeyword;

    // 1. Match exato
    if (p === k) return true;

    // 2. Para keywords de uma só palavra: exige que seja token isolado
    //    (não "ram" dentro de "ferramentas")
    if (!k.includes(' ')) {
        // boundary: início/fim de string ou caractere não-alfanumérico
        const re = new RegExp('(?:^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:[^a-z0-9]|$)', 'u');
        return re.test(p);
    }

    // 3. Keyword multi-palavra: substring simples (já é específica o suficiente)
    return p.includes(k);
}

// ============================================================
// DISPATCH v2.1.0
// ============================================================
export function dispatch(prompt) {
    const normalized = normalize(prompt);
    const registry   = loadRegistry();

    // 1. Casa com ferramenta do registry (tool call)
    for (const tool of registry.tools) {
        const matched = tool.trigger_keywords.some(kw =>
            keywordMatches(normalized, normalize(kw))
        );
        if (matched) {
            const resolvedTool = { ...tool };
            if (resolvedTool.path)    resolvedTool.path    = resolveDate(resolvedTool.path);
            if (resolvedTool.command) resolvedTool.command = resolveDate(resolvedTool.command);
            return { intent: INTENT.TOOL_CALL, tool: resolvedTool };
        }
    }

    // 2. Fallback: intent por palavras-chave (sem ferramenta)
    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
        if (keywords.some(kw => normalized.includes(normalize(kw)))) {
            return { intent, tool: null };
        }
    }

    // 3. Padrão conversacional
    return { intent: INTENT.CREATIVE_TASK, tool: null };
}
