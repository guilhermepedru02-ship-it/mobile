# Kanban do Workspace Mobile

> Atualizado em 01/06/2026 · Claude Sonnet 4.6 via MCP · `ollama_agent.js` v2.2.0: Gatekeeper auto-refresh + Cloud-First KNOWLEDGE/CREATIVE

---

## 🎯 Objetivos Atuais

- **IMEDIATO:** Reiniciar o Agente Local com `ws-restart` para ativar o `ollama_agent.js` v2.2.0
- **IMEDIATO:** `git push origin main` no Termux (commits acumulados há várias sessões)
- **IMEDIATO:** Instalar app **Termux:API** da Play Store → desbloqueia wifi/location/TTS na bridge
- **PRÓXIMO:** Testar `/local quem você é?` após 30min idle → deve funcionar (gatekeeper fix)
- **PRÓXIMO:** Testar `/local o que é RAG?` → deve responder via Gemini, não Qwen
- Aguardar reset de quota do Gemini (à meia-noite) para testar cloud-first
- `node Scripts/core/consolidate_rag.js` ao fim de cada dia

---

## 📋 Backlog

### 🔌 FASE 6 — Validação e Evolução
- [ ] **6.1.2 — Testes ao vivo com Claude via MCP** · Chamar `/bridge/battery` e `/bridge/wifi` via MCP para validar o pipeline completo
- [ ] **6.1.3 — Validar auditoria** · Verificar `Logs/android-bridge-audit.log` após testes
- [ ] **6.1.4 — Validação semana 1** · Manter READ ativo por 7 dias antes de habilitar WRITE automático

### 🧠 Arquitetura — Refinamentos Futuros
- [ ] **Consolidacão RAG automática via cron** · `0 23 * * * node .../consolidate_rag.js`
- [ ] **Reindexar com vector_db_v2.js** · Cache v2 (23KB) indica indexação parcial
- [ ] **Filtro de data e decaimento temporal no RAG** · Memórias recentes com peso maior
- [ ] **Remover pasta `Workspace/` fantasma** · `rm -rf /storage/emulated/0/Workspace/Workspace/`
- [ ] **Escopo `read:storage` dedicado** · `bridge_permissions.json` v1.1: adicionar escopo próprio para storage

---

## 🔨 Em Progresso

- [ ] **git push origin main** · Necessário no Termux (rede externa bloqueada no MCP)
- [ ] **Quota Gemini** · Reset automático à meia-noite
- [ ] **Validar termux-api** · `pkg install termux-api` + app Termux:API da Play Store

---

## ✅ Concluído

### 01/06/2026 — Fix Gatekeeper + Cloud-First (Claude Sonnet 4.6)
- [x] **`ollama_agent.js` v2.2.0** · `ensureGatekeeperUnlocked()`: auto-refresh a cada 28min. Previne o ACCESS DENIED após 30min de inatividade. (Claude, 01/06/2026)
- [x] **Cloud-First para KNOWLEDGE_QUERY e CREATIVE_TASK** · Baseado em 129 interações reais: Qwen 0.5B falha consistentemente nessas categorias. KNOWLEDGE/CREATIVE vai direto para Gemini. Qwen mantido apenas como executor de ferramentas + fallback de emergência. (Claude, 01/06/2026)

### 01/06/2026 — FASE 6: Android Bridge Gateway
- [x] **`bridge_permissions.json` v1.0.0** · Escopos por IA. (Claude, 01/06/2026)
- [x] **`bridge_audit.js` v1.0.0** · Auditoria imutável. (Claude, 01/06/2026)
- [x] **`bridge_middleware.js` v1.0.0** · Zero trust. (Claude, 01/06/2026)
- [x] **`android_bridge.js` v1.0.0** · Porta 4444. READ + WRITE + Kill switch. (Claude, 01/06/2026)
- [x] **`Projetos/hub_pwa/`** · server.js (5555) + PWA completo. (Claude, 01/06/2026)
- [x] **Bridge validada ao vivo** · battery ✔️ | wifi ✔️ (limitado) | clipboard DENIED (scope) ✔️ segurancça ok. (Guilherme, 01/06/2026)
- [x] **Tokens BRIDGE configurados no .env** · 256 bits de entropia. (Guilherme, 01/06/2026)
- [x] **Bootstrap v3.0** · 7 serviços: llama + workspace_agent + agente + MCP + bot + bridge + hub. (Claude, 01/06/2026)

### 01/06/2026 — Diagnóstico Massivo + Refinamentos
- [x] **7/7 serviços verdes** · Stack completo validado. (Claude, 01/06/2026)
- [x] **`dispatch.js` v2.1.0** · `keywordMatches()` com 3 estratégias em cascata. (Claude, 01/06/2026)
- [x] **`context_builder.js` v2.2.0** · Sem tags [CTX], texto plano, <300 tokens. (Claude, 01/06/2026)
- [x] **`ollama_agent.js` v2.1.0** · tool_error_guard + quality_filter_v2. (Claude, 01/06/2026)
- [x] **`consolidate_rag.js`** · 129 wm_*.json consolidados. (Claude, 01/06/2026)
- [x] **Bot Telegram** · Migrado Anthropic → Gemini. (Claude, 01/06/2026)

### 31/05/2026 — Vector DB v2 + Embeddings
- [x] **`vector_db_v2.js`** · Vetorial com MiniSearch fallback, indexação incremental. (01/06/2026)
- [x] **`start_llama_server.sh` v2.1** · `--embeddings --pooling mean`. (Claude, 31/05/2026)
- [x] **`identity_check` corrigido** · Shell inline no tool_registry v2.7.0. (Claude, 31/05/2026)
- [x] **JSON de erro não vaza mais como resposta** · tool_error_guard v2.1.0. (Claude, 31/05/2026)

### FASES 0-5 — Fundação Completa
- [x] Remover Ollama, validar llama-server + Qwen 0.5B Q4_K_M
- [x] workspace_agent_server.js (3333)
- [x] working_memory.js + pipeline completo
- [x] cloud_bridge.js + Gemini fallback
- [x] Git remoto GitHub + DevTools v2.2
- [x] API REST (4000) + Bearer Token
- [x] Bot Telegram completo
- [x] Milestones 0, 1, 2, 3 e 4 COMPLETOS
