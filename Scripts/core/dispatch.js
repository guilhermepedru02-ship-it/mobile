import fs from 'fs';
import path from 'path';

const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';
const REGISTRY_PATH = path.join(WORKSPACE_ROOT, 'Scripts/core/tool_registry.json');

// Tipos de intencao reconhecidos
export const INTENT = {
    TOOL_CALL:       'TOOL_CALL',
    CODE_TASK:       'CODE_TASK',
    KNOWLEDGE_QUERY: 'KNOWLEDGE_QUERY',
    MEMORY_WRITE:    'MEMORY_WRITE',
    CREATIVE_TASK:   'CREATIVE_TASK'
};

// Palavras-chave por intencao (fallback quando nenhuma ferramenta casa)
const INTENT_KEYWORDS = {
    [INTENT.CODE_TASK]:       ['cria', 'crie', 'codifica', 'programa', 'script', 'instala', 'npm', 'git commit', 'refatora'],
    [INTENT.KNOWLEDGE_QUERY]: ['o que é', 'explica', 'como funciona', 'qual', 'por que', 'diferença entre', 'busca'],
    [INTENT.MEMORY_WRITE]:    ['lembre', 'registra', 'anota', 'memoriza', 'salva isso', 'guarda'],
    [INTENT.CREATIVE_TASK]:   ['escreve', 'redige', 'gera texto', 'cria um texto', 'componha']
};

// Carrega o registry do disco
function loadRegistry() {
    try {
        return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    } catch {
        return { tools: [] };
    }
}

// Resolve datas dinâmicas em paths do registry
function resolveDate(str) {
    const date = new Date().toISOString().slice(0, 10);
    return str.replace(/__DATE__/g, date);
}

/**
 * Classifica o prompt e retorna { intent, tool | null }
 * @param {string} prompt - Texto bruto do usuário
 * @returns {{ intent: string, tool: object|null }}
 */
export function dispatch(prompt) {
    const lower = prompt.toLowerCase();
    const registry = loadRegistry();

    // 1. Tenta casar com uma ferramenta do registry
    for (const tool of registry.tools) {
        const matched = tool.trigger_keywords.some(kw => {
            const k = kw.toLowerCase();
            // Word-boundary: evita que "ram" case dentro de "ferramentas"
            const re = new RegExp('(^|[\\s,!?])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([\\s,!?]|$)', 'u');
            return re.test(lower) || lower === k;
        });
        if (matched) {
            // Resolve datas dinamicas no path se existir
            const resolvedTool = { ...tool };
            if (resolvedTool.path) resolvedTool.path = resolveDate(resolvedTool.path);
            if (resolvedTool.command) resolvedTool.command = resolveDate(resolvedTool.command);
            return { intent: INTENT.TOOL_CALL, tool: resolvedTool };
        }
    }

    // 2. Fallback para classificação por palavras-chave de intencao
    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
        if (keywords.some(kw => lower.includes(kw))) {
            return { intent, tool: null };
        }
    }

    // 3. Padrao: tarefa criativa/conversacional
    return { intent: INTENT.CREATIVE_TASK, tool: null };
}
