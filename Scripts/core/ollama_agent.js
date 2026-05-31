import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { dispatch, INTENT } from './dispatch.js';
import { buildContext } from './context_builder.js';
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
// EXECUTOR DE FERRAMENTA
// ==========================================
async function executeTool(tool) {
    const action = { type: tool.type };
    if (tool.command) action.command = tool.command;
    if (tool.path)    action.path    = tool.path;
    if (tool.content) action.content = tool.content;
    const result = await processAgentAction(action);
    return result;
}

// ==========================================
// VERIFICA SE DEVE DELEGAR PARA CLOUD
// ==========================================
function shouldDelegateToCloud(intent, tool, rules) {
    const alwaysLocal = rules.delegation_rules?.always_local ?? [];
    if (tool && alwaysLocal.includes(tool.id)) return false;
    const autoIntents = rules.delegation_rules?.auto ?? [];
    return autoIntents.includes(intent) || intent === INTENT.CODE_TASK;
}

// ==========================================
// PIPELINE PRINCIPAL
// ==========================================
export async function runAgent(userPrompt) {
    const logPath = path.join(WORKSPACE_ROOT, 'Logs/agent-audit.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const log = msg => fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`, 'utf8');

    log(`INPUT: ${userPrompt}`);
    const rules = loadRules();
    const maxAttempts = rules.retry_policy?.max_local_attempts ?? 2;

    // 1. Dispatch — classificar intençao e identificar ferramenta
    const { intent, tool } = dispatch(userPrompt);
    log(`DISPATCH: ${intent}${tool ? ` | TOOL: ${tool.id}` : ''}`);

    // 2. Working Memory — iniciar rastreamento da tarefa
    startTask(userPrompt);
    completeStep('dispatch', `intent=${intent}, tool=${tool?.id || 'none'}`);

    let toolOutput = null;
    let ragContext  = '';

    // 3. Executar ferramenta se identificada
    if (intent === INTENT.TOOL_CALL && tool) {
        log(`EXECUTING TOOL: ${tool.id}`);
        const result = await executeTool(tool);
        toolOutput = result.content || result.stdout || result.detail || JSON.stringify(result);
        completeStep(`tool_exec:${tool.id}`, toolOutput?.slice(0, 200));
        log(`TOOL RESULT: ${toolOutput?.slice(0, 100)}`);

        // 3b. Bypass explícito para identity_check (sem LLM, resultado determinístico)
        if (tool.id === 'identity_check' && toolOutput) {
            log('DIRECT OUTPUT: identity_check (bypass explícito)');
            completeStep('direct_output', 'identity_check');
            finishTask(String(toolOutput).slice(0, 300));
            return { success: true, intent, tool: tool.id, response: String(toolOutput), source: 'tool_direct' };
        }
    }


    // 4b. DIRECT OUTPUT BYPASS — ferramentas deterministicas nao precisam do Qwen
    // O output ja e texto legivel e enviamos direto sem gastar ctx-size
    const DIRECT_OUTPUT_TOOLS = [
        'identity_check', 'list_tools', 'ram_status', 'disk_usage', 'git_status', 'git_log',
        'services_health', 'self_health_check', 'llm_status', 'workspace_agent_status',
        'cloud_usage', 'kanban_read', 'diary_today'
    ];
    if (intent === INTENT.TOOL_CALL && tool && toolOutput && DIRECT_OUTPUT_TOOLS.includes(tool.id)) {
        log('DIRECT OUTPUT: ' + tool.id + ' (sem LLM)');
        completeStep('direct_output', tool.id);
        finishTask(toolOutput.slice(0, 300));
        return { success: true, intent, tool: tool.id, response: toolOutput, source: 'tool_direct' };
    }

    // 4. Context Builder — FIX v2.1: toolOutput injetado no system prompt
    // O buildSynthesisPrompt recebe o output real e instrui o Qwen a apresenta-lo
    // Isso impede que o modelo ignore ou alucine o resultado da ferramenta
    const { system, prompt } = buildContext(userPrompt, tool, toolOutput);
    ragContext = prompt;

    // 5. Ollama — gerar resposta com retry
    log(`CALLING OLLAMA (max ${maxAttempts} tentativas)...`);
    let response = '';
    let localSuccess = false;
    let lastError = '';


    // ============================================================
    // FORMAT RESPONSE — garante prefixo "Chronos:" e elimina
    // respostas genericas de chatbot que o Qwen 0.5B costuma gerar
    // quando o system prompt e ignorado.
    // ============================================================
    const GENERIC_PATTERNS = [
        /^ol[aá]!?\s*(como posso ajudar|o que posso fazer)/i,
        /^(oi|hey|ola),?\s*guilherme[!.]?\s*(como posso|o que)/i,
        /^(claro|entendido|certo)[!.]\s*como posso/i,
        /^(ol[aá]|oi)!?\s*como posso ajudar/i,
    ];
    function formatResponse(resp) {
        if (!resp) return resp;
        const r = resp.trim();
        // Substitui respostas completamente genericas
        if (GENERIC_PATTERNS.some(p => p.test(r))) {
            return 'Chronos: Pronto. O que você precisa?';
        }
        // Garante prefixo "Chronos:" se ausente
        if (!r.toLowerCase().startsWith('chronos')) {
            return `Chronos: ${r}`;
        }
        return r;
    }

    // Heuristica de qualidade para KNOWLEDGE_QUERY (Qwen 0.5B)
    // Detecta: repeticao excessiva de frases, respostas sobre hardware/software
    // quando o prompt nao menciona isso, e densidade semantica baixa.
    function isLowQuality(resp, userPrompt) {
        if (!resp) return false;
        const r = resp.toLowerCase();
        const words = r.split(/\s+/).filter(w => w.length > 4);
        // 1. Repeticao: mesma frase de 4+ palavras aparece 2+ vezes
        const phrases = [];
        for (let i = 0; i < words.length - 3; i++) {
            phrases.push(words.slice(i, i+4).join(' '));
        }
        const seen = new Set();
        for (const p of phrases) {
            if (seen.has(p)) return true;
            seen.add(p);
        }
        // 2. Resposta sobre hardware mobile/SSE quando prompt nao menciona
        const techDrift = /(hardware mobile|SSE bridge|flexibilidade de ponte|estado de inatividade|flexiveis de ponte)/i;
        if (techDrift.test(resp) && !/hardware|mobile|SSE|ponte/i.test(userPrompt)) return true;
        // 3. Resposta muito curta para KNOWLEDGE_QUERY (< 20 chars uteis)
        if (resp.trim().length < 20) return true;
        return false;
    }

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const candidate = await callOllama(system, prompt);
            if (candidate && candidate.trim().length > 3) {
                if (intent === 'KNOWLEDGE_QUERY' && isLowQuality(candidate, userPrompt)) {
                    lastError = `alucinacao detectada (tentativa ${attempt})`;
                    log(`OLLAMA LOW_QUALITY (tentativa ${attempt}/${maxAttempts}): forcando fallback`);
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

    // 6. Fallback para cloud se local falhou
    if (!localSuccess) {
        const canDelegate = shouldDelegateToCloud(intent, tool, rules);
        const fallbackEnabled = rules.retry_policy?.fallback_on_error ?? true;

        if (fallbackEnabled && canDelegate) {
            log('LOCAL FALHOU — delegando para cloud (FASE 3)');
            const contextForCloud = toolOutput
                ? `Ferramenta "${tool?.id}" retornou:\n${toolOutput.slice(0, 400)}`
                : '';
            const cloudResult = await consultExpertIA(userPrompt, contextForCloud);
            if (cloudResult.ok) {
                response = `[via ${cloudResult.backend}] ${cloudResult.response}`;
                log(`CLOUD RESPONSE OK: ${response.slice(0, 80)}`);
                finishTask(response.slice(0, 300));
                return {
                    success: true, intent, tool: tool?.id || null,
                    response, source: 'cloud', cloud_calls: cloudResult.call_count
                };
            } else {
                log(`CLOUD FAILED: ${cloudResult.error}`);
                finishTask(`Falha local e cloud: ${cloudResult.error}`);
                return {
                    success: false,
                    error: `Agente local indisponível e cloud falhou: ${cloudResult.error}`,
                    fallback: true
                };
            }
        } else {
            // Ferramenta determinística ou cloud desabilitado — reporta erro
            finishTask(`Erro local sem fallback: ${lastError}`);
            return {
                success: false,
                error: 'llama-server indisponível. Use /ia para fallback via Claude Web.',
                fallback: true
            };
        }
    }

    // 7. Finalizar working memory
    completeStep('llm_synthesis', response.slice(0, 200));
    finishTask(response.slice(0, 300));
    log('TASK FINISHED OK');

    return { success: true, intent, tool: tool?.id || null, response, source: 'local' };
}

// ==========================================
// SERVIDOR REST — PORTA 4001
// ==========================================
const app = express();
app.use(express.json());

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'Agente Local Online',
        model: OLLAMA_MODEL,
        port: AGENT_PORT,
        version: '2.0.0',
        features: ['retry', 'cloud_fallback', 'working_memory']
    });
});

// Endpoint principal
app.post('/agent', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Campo "prompt" obrigatório.' });
    }
    const result = await runAgent(prompt);
    res.json(result);
});

// Status do agente e working memory atual
app.get('/status', (req, res) => {
    const wm    = readTask();
    const rules = loadRules();
    res.json({
        agent: 'online',
        version: '2.0.0',
        model: OLLAMA_MODEL,
        retry_policy: rules.retry_policy,
        cloud_fallback: !!rules.cloud_backends?.length,
        active_task: wm ? { id: wm.task_id, description: wm.task_description, status: wm.status } : null
    });
});

// Auto-desbloqueio do Gatekeeper ao iniciar o agente
async function unlockGatekeeper() {
    try {
        await processAgentAction({ type: 'read_file', path: 'Cerebro/00_Sistema/README.md' });
        console.log('Gatekeeper: sessão desbloqueada.');
    } catch (e) {
        console.warn('Gatekeeper: falha no desbloqueio:', e.message);
    }
}

unlockGatekeeper();

app.listen(AGENT_PORT, '127.0.0.1', () => {
    const logPath = path.join(WORKSPACE_ROOT, 'Logs/agent-audit.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Agente Local v2.0.0 iniciado na porta ${AGENT_PORT} (retry=${true}, cloud_fallback=${true})\n`, 'utf8');
    console.log(`Agente Local v2.0.0 rodando em http://127.0.0.1:${AGENT_PORT}`);
    console.log('Funcionalidades: retry=2, cloud_fallback=cloud_bridge, working_memory=ativo');
});
