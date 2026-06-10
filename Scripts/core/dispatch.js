import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';
const REGISTRY_PATH  = path.join(WORKSPACE_ROOT, 'Scripts/core/tool_registry.json');
const BIOMETRIC_GATE = path.join(WORKSPACE_ROOT, 'Scripts/core/biometric_gate.sh');

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
    [INTENT.KNOWLEDGE_QUERY]: ['o que e', 'explica', 'como funciona', 'por que', 'diferenca entre', 'busca', 'entende', 'sabe', 'me conta', 'me diz', 'me explica', 'o sistema', 'o que voce', 'voce sabe', 'como foi', 'me ensina', 'me explica'],
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
// GATE BIOMÉTRICO — v2.9.0
// ============================================================
// Verifica se uma tool requer biometria e solicita autenticação.
// Retorna: { authorized: true } ou { authorized: false, reason: string }
// ============================================================
export function biometricCheck(tool) {
    if (!tool.requires_biometric) return { authorized: true };

    try {
        // Verifica se o script existe
        if (!fs.existsSync(BIOMETRIC_GATE)) {
            console.error('[BIOMETRIC] Gate script não encontrado:', BIOMETRIC_GATE);
            return { authorized: false, reason: 'GATE_UNAVAILABLE' };
        }

        const operationDesc = tool.biometric_label || tool.description?.slice(0, 60) || tool.id;
        execSync(`bash "${BIOMETRIC_GATE}" "${operationDesc.replace(/"/g, '')}"`
            , { stdio: 'inherit', timeout: 30000 });

        return { authorized: true };
    } catch (err) {
        // execSync lança se o exit code != 0
        const code = err.status || 1;
        if (code === 2) {
            return { authorized: false, reason: 'BIOMETRIC_UNAVAILABLE' };
        }
        return { authorized: false, reason: 'AUTH_DENIED' };
    }
}

// ============================================================
// MATCH DE KEYWORD — v2.1.0
// ============================================================
function keywordMatches(normalizedPrompt, normalizedKeyword) {
    const p = normalizedPrompt;
    const k = normalizedKeyword;

    // 1. Match exato
    if (p === k) return true;

    // 2. Para keywords de uma só palavra: exige que seja token isolado
    if (!k.includes(' ')) {
        const re = new RegExp('(?:^|[^a-z0-9])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:[^a-z0-9]|$)', 'u');
        return re.test(p);
    }

    // 3. Keyword multi-palavra: substring simples
    return p.includes(k);
}

// ============================================================
// DISPATCH v2.9.0 — + Biometric Gate
// ============================================================
export function dispatch(prompt) {
    const normalized = normalize(prompt);
    const registry   = loadRegistry();

    // 0. Match exato pelo ID da ferramenta (usuario digitou o nome da tool diretamente)
    const directToolMatch = registry.tools.find(t => normalize(t.id) === normalized || normalize(t.id).replace(/_/g, '') === normalized.replace(/[_\s-]/g, ''));
    if (directToolMatch) {
        return { intent: INTENT.TOOL_CALL, tool: directToolMatch };
    }

    // 1. Casa com ferramenta do registry (tool call)
    for (const tool of registry.tools) {
        const matched = tool.trigger_keywords.some(kw =>
            keywordMatches(normalized, normalize(kw))
        );
        if (matched) {
            const resolvedTool = { ...tool };
            if (resolvedTool.path)    resolvedTool.path    = resolveDate(resolvedTool.path);
            if (resolvedTool.command) resolvedTool.command = resolveDate(resolvedTool.command);

            // Verifica gate biométrico antes de retornar a tool
            if (resolvedTool.requires_biometric) {
                const check = biometricCheck(resolvedTool);
                if (!check.authorized) {
                    return {
                        intent: INTENT.TOOL_CALL,
                        tool: null,
                        blocked: true,
                        blocked_reason: check.reason,
                        blocked_tool_id: resolvedTool.id
                    };
                }
            }

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
