# Sessão 2026-06-01 — Fix Gatekeeper Auto-Refresh + Cloud-First KNOWLEDGE

**Agente:** Claude Sonnet 4.6 via MCP Workspace-Telemovel
**Contextualizacão:** Retomada de sessão anterior (Manus) que diagnosticou mas não implementou o fix

---

## Problema Resolvido

### Bug: Gatekeeper re-lock após 30min de inatividade

**Causa raiz precisa:**
`executor.js` tem `SESSION_TIMEOUT_MS = 30min`. A variável `hasReadRules` volta para `false` após 30min sem nenhuma chamada a `processAgentAction()`. O `unlockGatekeeper()` em `ollama_agent.js` só rodava uma única vez no startup. Qualquer `TOOL_CALL` depois de 30min de inatividade retornava `ACCESS DENIED`.

**Evidência nos logs da sessão anterior (Manus):**
```json
{ "response": "Chronos: Ferramenta identity_check indisponível. Erro: ACCESS DENIED (GATEKEEPER MCP)" }
{ "response": "Chronos: Ferramenta self_health_check indisponível. Erro: ACCESS DENIED (GATEKEEPER MCP)" }
```

**Fix implementado em `ollama_agent.js` v2.2.0:**
```javascript
let gatekeeperLastUnlocked = 0;
const GATEKEEPER_REFRESH_MS = 28 * 60 * 1000; // 2min antes do lock

async function ensureGatekeeperUnlocked() {
    const now = Date.now();
    if (now - gatekeeperLastUnlocked > GATEKEEPER_REFRESH_MS) {
        await processAgentAction({ type: 'read_file', path: 'Cerebro/00_Sistema/README.md' });
        gatekeeperLastUnlocked = now;
    }
}

async function executeTool(tool) {
    await ensureGatekeeperUnlocked(); // ← aqui
    ...
}
```

Custo: leitura de arquivo local (~1ms), no máximo a cada 28 minutos.

---

## Melhoria Arquitetural: Cloud-First para KNOWLEDGE_QUERY e CREATIVE_TASK

**Baseado nos dados reais de 129 interações (`2026-06-01_diagnostico_qwen_limites.md`):**
- `KNOWLEDGE_QUERY` via Qwen 0.5B: falha ~100% (alucinações, deriva emocional, respostas genéricas)
- `CREATIVE_TASK` via Qwen 0.5B: ~0% de utilidade

**Novo fluxo no `runAgent()` v2.2.0:**
```
INTENT = KNOWLEDGE_QUERY ou CREATIVE_TASK
    ↓
consultExpertIA() [Gemini] ← direto, sem passar pelo Qwen
    ↓
se cloud falhar (quota/sem chave) → Qwen como fallback de emergência
```

O Qwen 0.5B agora é estritamente um classificador/executor:
- Classifica intent via dispatch.js (já era assim)
- Executa ferramentas determinísticas (já era assim)
- Não tenta sintetizar conhecimento ou criatividade

---

## Detalhes do `ollama_agent.js` v2.2.0

**Novas features no `/status`:**
```json
{
  "version": "2.2.0",
  "gatekeeper_last_unlocked": "2026-06-01T04:00:00.000Z",
  "gatekeeper_refresh_interval_min": 28,
  "cloud_first_intents": ["KNOWLEDGE_QUERY", "CREATIVE_TASK"]
}
```

**Fix no `unlockGatekeeper()`:**
Agora também seta `gatekeeperLastUnlocked = Date.now()` na inicialização, para evitar um refresh desnecessário na primeira execução de ferramenta.

---

## Estado do Sistema na Sessão

- Bootstrap v3.0: já gerenciava 7 serviços (Bridge + Hub PWA adicionados em sessão anterior)
- `ollama_agent.js`: atualizado de v2.1.0 → v2.2.0
- `android_bridge.js`: implementado e validado (sessão anterior)
- `hub_pwa`: implementado e validado (sessão anterior)

## Próximos Passos

1. **Guilherme reinicia o agente:** `ws-restart` ou `pkill -f ollama_agent && cd Scripts/core && node ollama_agent.js`
2. **Testar:** `/local quem você é?` → deve funcionar mesmo após 30min de idle
3. **Testar:** `/local o que é RAG?` → deve ir para Gemini, não para Qwen
4. Instalar app **Termux:API** da Play Store para desbloquear wifi/location/clipboard na bridge
5. `git push origin main` para sincronizar tudo

## Palavras-chave
#gatekeeper-fix #auto-refresh #cloud-first #knowledge-query #qwen-classifier #ollama-agent-v2.2.0 #2026-06-01
