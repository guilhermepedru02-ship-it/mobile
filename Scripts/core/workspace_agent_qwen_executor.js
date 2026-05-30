/**
 * workspace_agent_qwen_executor.js — FASE 2
 * Integra o Qwen 0.5B como camada de interpretação do workspace_agent.
 *
 * Política de uso:
 *   - Payload estruturada { route, body }: BYPASS do Qwen — exec direto na porta 3333.
 *   - String em linguagem natural: Qwen interpreta → converte para payload → executa.
 *
 * Node 26+ — usa fetch global nativo (sem dependências extras).
 */

const AGENT_URL      = 'http://127.0.0.1:3333';
const LLM_URL        = 'http://127.0.0.1:11434/v1/chat/completions';
const LLM_MODEL      = 'qwen2.5-0.5b';
const LLM_TIMEOUT_MS = 40000;

// =========================================================
// ROTAS DETERMINÍSTICAS — bypass direto, sem Qwen
// =========================================================
const DETERMINISTIC_ROUTES = new Set([
    'read_file', 'write_file', 'append_file',
    'delete_file', 'move_file', 'list_dir',
    'run_script', 'shell_exec', 'apply_patch'
]);

function isDeterministic(input) {
    return (
        input &&
        typeof input === 'object' &&
        typeof input.route === 'string' &&
        DETERMINISTIC_ROUTES.has(input.route) &&
        typeof input.body === 'object'
    );
}

// =========================================================
// CHAMADA DIRETA AO workspace_agent_server
// =========================================================
async function callWorkspaceAgent(route, body) {
    const res = await fetch(`${AGENT_URL}/${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        throw new Error(`workspace_agent HTTP ${res.status} na rota /${route}`);
    }
    return await res.json();
}

// =========================================================
// INTERPRETAÇÃO VIA QWEN (instruções em linguagem natural)
// =========================================================
const INTERPRETATION_SYSTEM =
`Você é um agente executor. Converta a instrução em JSON de ação.

Rotas disponíveis:
- read_file: {"path":"relativo"}
- write_file: {"path":"relativo","content":"texto"}
- append_file: {"path":"relativo","content":"texto"}
- delete_file: {"path":"relativo"}
- move_file: {"source":"origem","destination":"destino"}
- list_dir: {"path":"relativo"}
- run_script: {"script_path":"script.sh","args":[]}
- shell_exec: {"command":"cmd"}

Responda SOMENTE JSON:
{"route":"nome","body":{...}}
Ou se não mapeavel:
{"route":null,"reason":"motivo"}`.trim();

async function interpretWithQwen(instruction) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
    try {
        const res = await fetch(LLM_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                model: LLM_MODEL,
                messages: [
                    { role: 'system', content: INTERPRETATION_SYSTEM },
                    { role: 'user',   content: instruction }
                ],
                max_tokens:  80,
                temperature: 0.0,
                stream:      false
            })
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`llama-server HTTP ${res.status}`);
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content ?? '';
        const clean = raw.replace(/```json|```/g, '').trim();
        return JSON.parse(clean);
    } catch (err) {
        clearTimeout(timer);
        throw new Error(`Qwen interpretation failed: ${err.message}`);
    }
}

// =========================================================
// EXECUTOR PRINCIPAL (export público)
// =========================================================
/**
 * Executa uma ação no workspace via workspace_agent_server.
 *
 * Aceita dois formatos:
 *   1. Payload estruturada: { route: 'read_file', body: { path: '...' } }
 *      -> Bypass do Qwen, execução direta (rápido, zero RAM extra).
 *   2. String em linguagem natural: 'leia o arquivo do kanban'
 *      -> Qwen interpreta e converte antes de executar.
 *
 * @param {object|string} input
 * @returns {Promise<{ ok, route, result, source: 'direct'|'qwen' }>}
 */
export async function executeWorkspaceTask(input) {
    // Caminho 1: estruturado — bypass Qwen
    if (isDeterministic(input)) {
        const result = await callWorkspaceAgent(input.route, input.body);
        return { ok: !!result.ok, route: input.route, result, source: 'direct' };
    }

    // Caminho 2: linguagem natural — Qwen interpreta
    const instruction = typeof input === 'string' ? input : JSON.stringify(input);
    let interpreted;
    try {
        interpreted = await interpretWithQwen(instruction);
    } catch (err) {
        return {
            ok: false, route: null,
            result: { error: `Qwen indisponível: ${err.message}` },
            source: 'qwen'
        };
    }

    if (!interpreted.route) {
        return {
            ok: false, route: null,
            result: { error: interpreted.reason ?? 'Instrução não mapeada.' },
            source: 'qwen'
        };
    }

    const result = await callWorkspaceAgent(interpreted.route, interpreted.body ?? {});
    return { ok: !!result.ok, route: interpreted.route, result, source: 'qwen' };
}

// =========================================================
// CLI DE TESTE — node workspace_agent_qwen_executor.js "instrucao"
// =========================================================
if (process.argv[2]) {
    const input = process.argv[2];
    console.log(`\n▶ Input:`, input);
    try {
        const out = await executeWorkspaceTask(input);
        console.log(`▶ source=${out.source} | route=${out.route} | ok=${out.ok}`);
        console.log('▶ result:', JSON.stringify(out.result, null, 2).slice(0, 600));
    } catch (err) {
        console.error('▶ ERRO:', err.message);
    }
}
