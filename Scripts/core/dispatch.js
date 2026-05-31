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
// Remove diacríticos antes do match — garante que "diagnóstico"
// case com keyword "diagnostico" e vice-versa, de forma sistemática.
// Aplica-se TANTO ao prompt do usuário QUANTO às keywords do registry.
// ============================================================
function normalize(str) {
    return str
        .normalize('NFD')                      // decompõe caracteres acentuados
        .replace(/\p{Diacritic}/gu, '')        // remove marcas diacríticas
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
// DISPATCH
// ============================================================
/**
 * Classifica o prompt do usuário e retorna { intent, tool | null }.
 *
 * Matching robusto:
 *   - Normalização Unicode em ambos os lados (prompt e keyword)
 *   - Word-boundary regex para evitar falsos positivos ("ram" em "ferramentas")
 *   - Exact-match como fallback ao regex
 *
 * @param  {string} prompt — Texto bruto do usuário
 * @returns {{ intent: string, tool: object|null }}
 */
export function dispatch(prompt) {
    const normalized = normalize(prompt);
    const registry   = loadRegistry();

    // 1. Casa com ferramenta do registry (tool call)
    for (const tool of registry.tools) {
        const matched = tool.trigger_keywords.some(kw => {
            const k  = normalize(kw);
            // Word-boundary: evita que "ram" case dentro de "ferramentas"
            const re = new RegExp(
                '(^|[\\s,!?])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([\\s,!?]|$)',
                'u'
            );
            return re.test(normalized) || normalized === k;
        });
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
