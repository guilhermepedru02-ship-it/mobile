import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { dispatch, INTENT } from './dispatch.js';
import { buildContext, buildRAGContext } from './context_builder.js';
import { startTask, completeStep, finishTask, readTask } from './working_memory.js';
import { processAgentAction } from './executor.js';
import { consultExpertIA } from './cloud_bridge.js';

const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';
const OLLAMA_URL     = 'http://localhost:11434/v1/chat/completions';
const OLLAMA_MODEL   = 'qwen2.5-0.5b';
const AGENT_PORT     = 4001;
const TIMEOUT_MS     = 50000;
const RULES_PATH     = path.join(WORKSPACE_ROOT, 'Scripts/core/agent_rules.json');

// ==========================================
// REGRAS DE DELEGAÇÃO
// ==========================================
function loadRules() {
    try {
        return JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
    } catch {
        return { retry_policy: { max_local_attempts: 2, fallback_on_error: true } };
    }
}

// ==========================================
// GATEKEEPER AUTO-REFRESH — FIX v2.2.0
// ==========================================
// Causa do bug: executor.js re-bloqueia após 30min de inatividade.
// O unlockGatekeeper() só rodava no startup — qualquer TOOL_CALL
// depois de 30min retornava ACCESS DENIED.
//
// Solução: rastrear quando desbloqueamos. Se passaram >28min,
// re-lemos o README antes de qualquer executeTool().
// Custo: um readFileSync local, ~1ms. Zero impacto na prática.
// ==========================================
let gatekeeperLastUnlocked = 0;
const GATEKEEPER_REFRESH_MS = 28 * 60 * 1000; // 28min (2min antes do lock de 30min)

async function ensureGatekeeperUnlocked() {
    const now = Date.now();
    if (now - gatekeeperLastUnlocked > GATEKEEPER_REFRESH_MS) {
        try {
            await processAgentAction({ type: 'read_file', path: 'Cerebro/00_Sistema/README.md' });
            gatekeeperLastUnlocked = now;
        } catch {
            // silencioso — o proprio executeTool vai retornar o erro se falhar
        }
    }
}

// ==========================================
// INFERÊNCIA NO LLAMA-SERVER
// ==========================================
async function callOllama(system, prompt) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(OLLAMA_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                messages: [
                    { role: 'system', content: system },
                    { role: 'user',   content: prompt  }
                ],
                max_tokens:  400,
                temperature: 0.3,
                stream:      false
            })
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`llama-server HTTP ${res.status}`);
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
    } catch (err) {
        clearTimeout(timer);
        throw err;
    }
}

// ==========================================
// EXECUTOR DE FERRAMENTA — com Gatekeeper auto-refresh
// ==========================================
async function executeTool(tool) {
    // FIX v2.2.0: garante que o Gatekeeper está desbloqueado antes
    // de qualquer processAgentAction. Previne o lock de 30min de inatividade.
    await ensureGatekeeperUnlocked();

    const action = { type: tool.type };
    if (tool.command) action.command = tool.command;
    if (tool.path)    action.path    = tool.path;
    if (tool.content) action.content = tool.content;
    const result = await processAgentAction(action);
    return result;
}

// ==========================================
// DELEGAÇÃO PARA CLOUD
// ==========================================
function shouldDelegateToCloud(intent, tool, rules) {
    const alwaysLocal = rules.delegation_rules?.always_local ?? [];
    if (tool && alwaysLocal.includes(tool.id)) return false;
    const autoIntents = rules.delegation_rules?.auto ?? [];
    return autoIntents.includes(intent) || intent === INTENT.CODE_TASK;
}

// ==========================================
// FORMAT RESPONSE
// ==========================================
const GENERIC_PATTERNS = [
    /^ol[aá]!?\s*(como posso ajudar|o que posso fazer)/i,
    /^(oi|hey|ola),?\s*guilherme[!.]?\s*(como posso|o que)/i,
    /^(claro|entendido|certo)[!.]\s*como posso/i,
    /^(ol[aá]|oi)!?\s*como posso ajudar/i,
    /^como voc[eê] est[aá] se sentindo/i,
    /^estou (bem|ótimo|ótima|pronto|pronta),?\s*(obrigad|como posso|o que)/i,
    /^(é claro que|claro que)\s*(estou|sim|posso)/i,
];

function formatResponse(resp) {
    if (!resp) return resp;
    const r = resp.trim();
    if (GENERIC_PATTERNS.some(p => p.test(r))) {
        return 'Chronos: Pronto. O que você precisa?';
    }
    if (!r.toLowerCase().startsWith('chronos')) {
        return `Chronos: ${r}`;
    }
    return r;
}

// ==========================================
// HEURÍSTICA DE QUALIDADE — Qwen 0.5B
// ==========================================
function isLowQuality(resp, userPrompt) {
    if (!resp) return false;
    const r = resp.toLowerCase();
    const words = r.split(/\s+/).filter(w => w.length > 4);

    // 1. Repetição
    const phrases = [];
    for (let i = 0; i < words.length - 3; i++) {
        phrases.push(words.slice(i, i+4).join(' '));
    }
    const seen = new Set();
    for (const p of phrases) {
        if (seen.has(p)) return true;
        seen.add(p);
    }

    // 2. Tech drift
    const techDrift = /(hardware mobile|SSE bridge|flexibilidade de ponte|estado de inatividade|flexiveis de ponte)/i;
    if (techDrift.test(resp) && !/hardware|mobile|SSE|ponte/i.test(userPrompt)) return true;

    // 3. Resposta muito curta
    if (resp.trim().length < 20) return true;

    // 4. Deriva emocional
    const emotionalDrift = /como voc[eê] est[aá] se sentindo|estou (bem|ótimo|pronto),? (obrigad|como posso|o que)/i;
    if (emotionalDrift.test(resp) && !/sentindo|emoc|humor|como est[aá]/i.test(userPrompt)) return true;

    // 5. JSON cru vazando
    const jsonLeak = /^\s*\{\s*"(success|error|type|code)"/;
    if (jsonLeak.test(resp)) return true;

    // 6. Off-topic absoluto
    const offTopic = /receita de|previsao do tempo|campeonato|resultado do jogo/i;
    if (offTopic.test(resp) && !/receita|clima|tempo|campeonato|jogo/i.test(userPrompt)) return true;

    return false;
}

// ==========================================
// PIPELINE PRINCIPAL — v2.2.0
// ==========================================
export async function runAgent(userPrompt) {
    const logPath = path.join(WORKSPACE_ROOT, 'Logs/agent-audit.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const log = msg => fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`, 'utf8');

    log(`INPUT: ${userPrompt}`);
    const rules      = loadRules();
    const maxAttempts = rules.retry_policy?.max_local_attempts ?? 2;

    // 1. Dispatch
    const { intent, tool } = dispatch(userPrompt);
    log(`DISPATCH: ${intent}${tool ? ` | TOOL: ${tool.id}` : ''}`);

    startTask(userPrompt);
    completeStep('dispatch', `intent=${intent}, tool=${tool?.id || 'none'}`);

    // ==========================================
    // CLOUD-FIRST — v2.2.0
    // ==========================================
    // Baseado em dados reais de 129 interações (2026-06-01_diagnostico_qwen_limites.md):
    // Qwen 0.5B falha em KNOWLEDGE_QUERY e CREATIVE_TASK ~100% das vezes.
    // Roteamos diretamente para cloud e só tentamos Qwen se cloud falhar.
    // ==========================================
    const CLOUD_FIRST_INTENTS = [INTENT.KNOWLEDGE_QUERY, INTENT.CREATIVE_TASK];
    if (CLOUD_FIRST_INTENTS.includes(intent) && !tool) {
        log(`CLOUD_FIRST: ${intent} → delegando direto para cloud (Qwen não usa)`);
        completeStep('cloud_first', intent);
        const ragContext = await buildRAGContext(userPrompt);
        const cloudContext = ragContext ? `[Memória RAG Local]\n${ragContext}` : '';
        const cloudResult = await consultExpertIA(userPrompt, cloudContext);
        if (cloudResult.ok) {
            const resp = cloudResult.response;
            log(`CLOUD_FIRST OK (${cloudResult.backend}): ${resp.slice(0, 80)}`);
            finishTask(resp.slice(0, 300));
            return { success: true, intent, tool: null, response: resp, source: 'cloud', cloud_calls: cloudResult.call_count };
        }
        // Cloud indisponível (quota, sem chave) → Qwen como último recurso
        log(`CLOUD_FIRST FAILED (${cloudResult.error}) — tentando Qwen como fallback de emergência`);
        // continua para o pipeline Qwen abaixo
    }

    let toolOutput = null;
    let toolFailed = false;

    // 3. Executar ferramenta se TOOL_CALL
    if (intent === INTENT.TOOL_CALL && tool) {
        log(`EXECUTING TOOL: ${tool.id}`);
        const result = await executeTool(tool);  // ← Gatekeeper auto-refresh aqui

        toolFailed = result.success === false;

        if (toolFailed) {
            const errMsg = result.error || 'Ferramenta retornou falha sem detalhe.';
            log(`TOOL FAILED: ${tool.id} — ${errMsg}`);
            completeStep(`tool_exec:${tool.id}`, `FAILED: ${errMsg}`);

            const DIRECT_OUTPUT_TOOLS = [
                'identity_check', 'list_tools', 'list_cerebro', 'ram_status', 'disk_usage', 'git_status', 'git_log',
                'services_health', 'self_health_check', 'llm_status', 'workspace_agent_status',
                'cloud_usage', 'kanban_read', 'diary_today'
            ];
            if (DIRECT_OUTPUT_TOOLS.includes(tool.id)) {
                const friendlyError = `Chronos: Ferramenta "${tool.id}" indisponível. Erro: ${errMsg}`;
                log(`DIRECT FAIL RESPONSE: ${tool.id}`);
                finishTask(`Falha: ${errMsg}`);
                return { success: false, intent, tool: tool.id, response: friendlyError, source: 'tool_error' };
            }
            toolOutput = null;

        } else {
            toolOutput = result.content || result.stdout || result.detail || JSON.stringify(result);
            completeStep(`tool_exec:${tool.id}`, toolOutput?.slice(0, 200));
            log(`TOOL SUCCESS: ${toolOutput?.slice(0, 100)}`);
        }

        // Bypass para identity_check (determinístico)
        if (tool.id === 'identity_check' && toolOutput && !toolFailed) {
            log('DIRECT OUTPUT: identity_check');
            completeStep('direct_output', 'identity_check');
            finishTask(String(toolOutput).slice(0, 300));
            return { success: true, intent, tool: tool.id, response: String(toolOutput), source: 'tool_direct' };
        }
    }

    // 4. DIRECT OUTPUT BYPASS — ferramentas determinísticas
    const DIRECT_OUTPUT_TOOLS = [
        'identity_check', 'list_tools', 'list_cerebro', 'ram_status', 'disk_usage', 'git_status', 'git_log',
        'services_health', 'self_health_check', 'llm_status', 'workspace_agent_status',
        'cloud_usage', 'kanban_read', 'diary_today'
    ];
    if (intent === INTENT.TOOL_CALL && tool && toolOutput && !toolFailed && DIRECT_OUTPUT_TOOLS.includes(tool.id)) {
        log('DIRECT OUTPUT: ' + tool.id);
        completeStep('direct_output', tool.id);
        finishTask(toolOutput.slice(0, 300));
        return { success: true, intent, tool: tool.id, response: toolOutput, source: 'tool_direct' };
    }

    // 4b. Context Builder
    const { system, prompt } = await buildContext(userPrompt, tool, toolOutput);

    // 5. Ollama — com retry (Qwen como último recurso para KNOWLEDGE/CREATIVE)
    log(`CALLING OLLAMA (max ${maxAttempts} tentativas)...`);
    let response = '';
    let localSuccess = false;
    let lastError = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const candidate = await callOllama(system, prompt);
            if (candidate && candidate.trim().length > 3) {
                if (intent === INTENT.KNOWLEDGE_QUERY && isLowQuality(candidate, userPrompt)) {
                    lastError = `qualidade baixa (tentativa ${attempt})`;
                    log(`OLLAMA LOW_QUALITY (tentativa ${attempt}/${maxAttempts})`);
                } else {
                    response = formatResponse(candidate);
                    localSuccess = true;
                    log(`OLLAMA OK (tentativa ${attempt}/${maxAttempts}): ${response.slice(0, 80)}`);
                    break;
                }
            }
            lastError = `resposta vazia (tentativa ${attempt})`;
            log(`OLLAMA VAZIO (tentativa ${attempt}/${maxAttempts})`);
        } catch (err) {
            lastError = err.message;
            log(`OLLAMA ERROR (tentativa ${attempt}/${maxAttempts}): ${err.message}`);
        }
        if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1000));
    }

    // 6. Fallback cloud (para TOOL_CALL que precisam de síntese)
    if (!localSuccess) {
        const canDelegate = shouldDelegateToCloud(intent, tool, rules);
        const fallbackEnabled = rules.retry_policy?.fallback_on_error ?? true;

        if (fallbackEnabled && canDelegate) {
            log('LOCAL FALHOU — cloud fallback');
            let contextForCloud = toolOutput ? `Ferramenta "${tool?.id}":\n${toolOutput.slice(0, 400)}` : '';
            if (!toolOutput) {
                const ragContext = await buildRAGContext(userPrompt);
                contextForCloud = ragContext ? `[Memória RAG Local]\n${ragContext}` : '';
            }
            const cloudResult = await consultExpertIA(userPrompt, contextForCloud);
            if (cloudResult.ok) {
                response = cloudResult.response;
                log(`CLOUD OK: ${response.slice(0, 80)}`);
                finishTask(response.slice(0, 300));
                return { success: true, intent, tool: tool?.id || null, response, source: 'cloud', cloud_calls: cloudResult.call_count };
            } else {
                log(`CLOUD FAILED: ${cloudResult.error}`);
                finishTask(`Falha local e cloud: ${cloudResult.error}`);
                return { success: false, error: `Local + cloud falharam: ${cloudResult.error}`, fallback: true };
            }
        } else {
            finishTask(`Erro local sem fallback: ${lastError}`);
            return { success: false, error: 'llama-server indisponível. Use /ia para fallback manual.', fallback: true };
        }
    }

    // 7. Finalizar
    completeStep('llm_synthesis', response.slice(0, 200));
    finishTask(response.slice(0, 300));
    log('TASK OK');
    return { success: true, intent, tool: tool?.id || null, response, source: 'local' };
}

// ==========================================
// SERVIDOR REST — PORTA 4001
// ==========================================
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        status: 'Agente Local Online',
        model: OLLAMA_MODEL,
        port: AGENT_PORT,
        version: '2.2.0',
        features: ['gatekeeper_autorefresh', 'cloud_first_knowledge', 'retry', 'cloud_fallback', 'working_memory', 'tool_error_guard', 'quality_filter_v2']
    });
});

app.post('/agent', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Campo "prompt" obrigatório.' });
    }
    const result = await runAgent(prompt);
    res.json(result);
});

app.get('/status', (req, res) => {
    const wm    = readTask();
    const rules = loadRules();
    res.json({
        agent: 'online',
        version: '2.2.0',
        model: OLLAMA_MODEL,
        gatekeeper_last_unlocked: gatekeeperLastUnlocked
            ? new Date(gatekeeperLastUnlocked).toISOString()
            : 'startup',
        gatekeeper_refresh_interval_min: Math.floor(GATEKEEPER_REFRESH_MS / 60000),
        retry_policy: rules.retry_policy,
        cloud_fallback: !!rules.cloud_backends?.length,
        cloud_first_intents: ['KNOWLEDGE_QUERY', 'CREATIVE_TASK'],
        active_task: wm ? { id: wm.task_id, description: wm.task_description, status: wm.status } : null
    });
});

async function unlockGatekeeper() {
    try {
        await processAgentAction({ type: 'read_file', path: 'Cerebro/00_Sistema/README.md' });
        gatekeeperLastUnlocked = Date.now(); // FIX v2.2.0: registra o tempo de desbloqueio
        console.log('Gatekeeper: sessão desbloqueada.');
    } catch (e) {
        console.warn('Gatekeeper: falha no desbloqueio:', e.message);
    }
}

unlockGatekeeper();

app.listen(AGENT_PORT, '127.0.0.1', () => {
    const logPath = path.join(WORKSPACE_ROOT, 'Logs/agent-audit.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath,
        `[${new Date().toISOString()}] Agente v2.2.0 iniciado na porta ${AGENT_PORT} ` +
        `(gatekeeper_autorefresh=28min, cloud_first=[KNOWLEDGE,CREATIVE], retry=2)\n`, 'utf8');
    console.log(`Agente Local v2.2.0 em http://127.0.0.1:${AGENT_PORT}`);
    console.log('Fixes: gatekeeper_autorefresh=28min | cloud_first KNOWLEDGE/CREATIVE | tool_error_guard | quality_filter_v2');
});
