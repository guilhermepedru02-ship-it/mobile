import express from 'express';
import fs from 'fs';
import path from 'path';
import { dispatch, INTENT } from './dispatch.js';
import { buildContext } from './context_builder.js';
import { startTask, completeStep, finishTask, readTask } from './working_memory.js';
import { processAgentAction } from './executor.js';

const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';
const OLLAMA_URL     = 'http://localhost:11434/v1/chat/completions';
const OLLAMA_MODEL   = 'qwen2.5-0.5b';
const AGENT_PORT     = 4001;
const TIMEOUT_MS     = 50000; // 50s

// ==========================================
// INFERENCIA NO OLLAMA
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
                max_tokens:  128,
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

    // Destravar o executor (requer que o README tenha sido lido na sessao MCP ativa)
    // O agente local opera na mesma sessao do MCP server, portanto já destravado.
    const result = await processAgentAction(action);
    return result;
}

// ==========================================
// PIPELINE PRINCIPAL
// ==========================================
export async function runAgent(userPrompt) {
    const logPath = path.join(WORKSPACE_ROOT, 'Logs/agent-audit.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const log = msg => fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${msg}\n`, 'utf8');

    log(`INPUT: ${userPrompt}`);

    // 1. Dispatch — classificar intencao e identificar ferramenta
    const { intent, tool } = dispatch(userPrompt);
    log(`DISPATCH: ${intent}${tool ? ` | TOOL: ${tool.id}` : ''}`);

    // 2. Working Memory — iniciar rastreamento da tarefa
    startTask(userPrompt);
    completeStep('dispatch', `intent=${intent}, tool=${tool?.id || 'none'}`);

    let toolOutput = null;

    // 3. Executar ferramenta se identificada
    if (intent === INTENT.TOOL_CALL && tool) {
        log(`EXECUTING TOOL: ${tool.id}`);
        const result = await executeTool(tool);
        toolOutput = result.content || result.stdout || result.detail || JSON.stringify(result);
        completeStep(`tool_exec:${tool.id}`, toolOutput?.slice(0, 200));
        log(`TOOL RESULT: ${toolOutput?.slice(0, 100)}`);
    }

    // 4. Context Builder — montar prompt final
    const toolSnippet = toolOutput ? toolOutput.slice(0, 200) : null;
    const enrichedPrompt = toolSnippet
        ? `${userPrompt}\n\nFerramenta "${tool.id}":\n${toolSnippet}`
        : userPrompt;
    const { system, prompt } = buildContext(enrichedPrompt, tool);

    // 5. Ollama — gerar resposta
    log('CALLING OLLAMA...');
    let response;
    try {
        response = await callOllama(system, prompt);
        log(`OLLAMA RESPONSE: ${response.slice(0, 100)}`);
    } catch (err) {
        log(`OLLAMA ERROR: ${err.message}`);
        finishTask(`Erro: ${err.message}`);
        return {
            success: false,
            error: 'Ollama indisponível. Use /ia para fallback via Claude.',
            fallback: true
        };
    }

    // 6. Finalizar working memory
    finishTask(response.slice(0, 300));
    log('TASK FINISHED');

    return { success: true, intent, tool: tool?.id || null, response };
}

// ==========================================
// SERVIDOR REST — PORTA 4001
// ==========================================
const app = express();
app.use(express.json());

// Health check
app.get('/', (req, res) => {
    res.json({ status: 'Agente Local Online', model: OLLAMA_MODEL, port: AGENT_PORT });
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
    const wm = readTask();
    res.json({
        agent: 'online',
        model: OLLAMA_MODEL,
        active_task: wm ? { id: wm.task_id, description: wm.task_description, status: wm.status } : null
    });
});

// Auto-desbloqueio do Gatekeeper ao iniciar o agente
async function unlockGatekeeper() {
    try {
        await processAgentAction({ type: 'read_file', path: 'Cerebro/00_Sistema/README.md' });
        console.log('Gatekeeper: sessao desbloqueada.');
    } catch (e) {
        console.warn('Gatekeeper: falha no desbloqueio:', e.message);
    }
}

unlockGatekeeper();

app.listen(AGENT_PORT, '127.0.0.1', () => {
    const logPath = path.join(WORKSPACE_ROOT, 'Logs/agent-audit.log');
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Agente Local iniciado na porta ${AGENT_PORT}\n`, 'utf8');
    console.log(`Agente Local rodando em http://127.0.0.1:${AGENT_PORT}`);
});
