/**
 * cloud_bridge.js — FASE 3: Ponte para IAs em Nuvem
 * Implementa consult_expert_ia para a Arquitetura do Enxame
 *
 * Versão: 1.0.0 · 2026-05-30 · Claude Sonnet 4.6
 *
 * Quando usar:
 *   O agente local (ollama_agent.js) tentou 2× sem sucesso → delega aqui.
 *   Aqui fazemos a chamada HTTP para a IA externa configurada em agent_rules.json.
 *
 * Configuração:
 *   Definir ANTHROPIC_API_KEY no .env do Workspace antes de usar.
 */

import fs from 'fs';
import path from 'path';

const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';
const RULES_PATH     = path.join(WORKSPACE_ROOT, 'Scripts/core/agent_rules.json');
const USAGE_PATH     = path.join(WORKSPACE_ROOT, 'Logs/cloud_usage.json');
const LOG_PATH       = path.join(WORKSPACE_ROOT, 'Logs/cloud_bridge.log');

// ============================================================
// UTILITÁRIOS
// ============================================================

function log(level, msg) {
    const entry = `[${new Date().toISOString()}] [${level}] ${msg}`;
    console.log(entry);
    try {
        fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
        fs.appendFileSync(LOG_PATH, entry + '\n', 'utf8');
    } catch { /* silencioso */ }
}

function loadRules() {
    try {
        return JSON.parse(fs.readFileSync(RULES_PATH, 'utf8'));
    } catch {
        return {
            retry_policy: { max_local_attempts: 2 },
            cloud_backends: [],
            cost_control: { max_cloud_calls_per_day: 20 }
        };
    }
}

// ============================================================
// CONTROLE DE CUSTOS — rastreamento de uso diário
// ============================================================

function loadUsage() {
    const today = new Date().toISOString().slice(0, 10);
    try {
        const raw = JSON.parse(fs.readFileSync(USAGE_PATH, 'utf8'));
        if (raw.date === today) return raw;
    } catch {}
    return { date: today, calls: 0, tokens_used: 0 };
}

function saveUsage(usage) {
    fs.mkdirSync(path.dirname(USAGE_PATH), { recursive: true });
    fs.writeFileSync(USAGE_PATH, JSON.stringify(usage, null, 2), 'utf8');
}

function checkDailyLimit(rules) {
    const limit = rules.cost_control?.max_cloud_calls_per_day ?? 20;
    const usage = loadUsage();
    const alertAt = Math.floor(limit * (rules.cost_control?.alert_at_percent ?? 80) / 100);
    return { allowed: usage.calls < limit, current: usage.calls, limit, alertAt };
}

export function getUsageSummary() {
    const rules    = loadRules();
    const limitInfo = checkDailyLimit(rules);
    const usage    = loadUsage();
    return {
        today: usage.date,
        calls_today: usage.calls,
        limit: limitInfo.limit,
        tokens_used: usage.tokens_used ?? 0,
        remaining: limitInfo.limit - usage.calls,
        percent_used: Math.round((usage.calls / limitInfo.limit) * 100)
    };
}

// ============================================================
// CHAMADA ANTHROPIC
// ============================================================

async function callAnthropic(backend, prompt) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY não configurada. Defina no .env do Workspace.');

    const res = await fetch(backend.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model: backend.model,
            max_tokens: backend.max_tokens ?? 1000,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Anthropic HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    return {
        text: data.content?.[0]?.text ?? '',
        tokens: (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0)
    };
}


// ============================================================
// CHAMADA GEMINI (Google AI Studio)
// ============================================================

async function callGemini(backend, prompt) {
    const apiKey = process.env[backend.api_key_env ?? 'GEMINI_API_KEY'];
    if (!apiKey) throw new Error(`${backend.api_key_env ?? 'GEMINI_API_KEY'} nao configurada no .env.`);

    const model = backend.model ?? 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: backend.max_tokens ?? 1000 }
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const tokens = (data.usageMetadata?.promptTokenCount ?? 0) + (data.usageMetadata?.candidatesTokenCount ?? 0);
    return { text, tokens };
}

// ============================================================
// CHAMADA OPENAI-COMPAT GENÉRICA (Antigravity, Manus, etc.)
// ============================================================

async function callOpenAICompat(backend, prompt) {
    const apiKey  = process.env[backend.api_key_env ?? 'OPENAI_API_KEY'] ?? '';
    const headers = { 'Content-Type': 'application/json' };
    if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

    const res = await fetch(backend.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model: backend.model,
            max_tokens: backend.max_tokens ?? 1000,
            messages: [{ role: 'user', content: prompt }]
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Backend "${backend.name}" HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    return {
        text: data.choices?.[0]?.message?.content ?? '',
        tokens: data.usage?.total_tokens ?? 0
    };
}

// ============================================================
// EXPORT PRINCIPAL: consultExpertIA
// ============================================================

/**
 * Consulta uma IA em nuvem com o prompt fornecido.
 * Chamada pelo agente local após max_local_attempts falhas.
 *
 * @param {string} prompt   - Instrução ou pergunta a ser respondida
 * @param {string} context  - Contexto adicional do workspace (RAG, kanban, etc.)
 * @returns {Promise<{ ok, response?, backend?, call_count?, error? }>}
 */
export async function consultExpertIA(prompt, context = '') {
    const rules      = loadRules();
    const limitCheck = checkDailyLimit(rules);

    log('INFO', `consultExpertIA chamado | uso hoje: ${limitCheck.current}/${limitCheck.limit}`);

    if (!limitCheck.allowed) {
        const msg = `Limite diário de ${limitCheck.limit} chamadas cloud atingido.`;
        log('WARN', msg);
        return { ok: false, error: msg };
    }

    // Alerta de uso elevado
    if (limitCheck.current >= limitCheck.alertAt) {
        log('WARN', `Uso cloud em ${Math.round((limitCheck.current / limitCheck.limit) * 100)}% do limite diário.`);
    }

    // Seleciona backend por prioridade
    const backends = (rules.cloud_backends ?? []).sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
    const backend  = backends[0];
    if (!backend) {
        return { ok: false, error: 'Nenhum backend cloud configurado em agent_rules.json.' };
    }

    // Monta o prompt completo com contexto do workspace
    const header = `[Contexto do Workspace Mobile — Chronos Local Android]`;
    const fullPrompt = context
        ? `${header}\n${context.slice(0, 800)}\n\n---\n[Tarefa delegada pelo agente local]\n${prompt}`
        : prompt;

    log('INFO', `Delegando para: ${backend.name} | modelo: ${backend.model} | prompt: ${prompt.slice(0, 80)}...`);

    try {
        let result;
        if (backend.name === 'anthropic') {
            result = await callAnthropic(backend, fullPrompt);
        } else if (backend.name === 'gemini') {
            result = await callGemini(backend, fullPrompt);
        } else {
            result = await callOpenAICompat(backend, fullPrompt);
        }

        // Registra uso
        const usage = loadUsage();
        usage.calls++;
        usage.tokens_used = (usage.tokens_used ?? 0) + (result.tokens ?? 0);
        saveUsage(usage);

        log('INFO', `Resposta OK | tokens: ${result.tokens} | total hoje: ${usage.calls}/${limitCheck.limit}`);
        return { ok: true, response: result.text, backend: backend.name, call_count: usage.calls };

    } catch (err) {
        log('ERROR', `Falha no backend ${backend.name}: ${err.message}`);
        return { ok: false, error: `Falha no backend ${backend.name}: ${err.message}` };
    }
}

// ============================================================
// CLI DE TESTE — node cloud_bridge.js "sua pergunta"
// ============================================================
if (process.argv[2]) {
    const prompt = process.argv.slice(2).join(' ');
    console.log(`\n▶ Consultando IA externa: "${prompt}"`);
    try {
        const result = await consultExpertIA(prompt);
        if (result.ok) {
            console.log(`\n✅ Resposta (via ${result.backend}, chamada #${result.call_count}):\n`);
            console.log(result.response);
            console.log(`\n📊 Uso hoje: ${result.call_count} chamadas`);
        } else {
            console.log(`\n❌ Erro: ${result.error}`);
        }
    } catch (err) {
        console.error('\n▶ ERRO:', err.message);
    }
}
