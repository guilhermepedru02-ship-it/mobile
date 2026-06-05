# Kanban do Workspace Mobile

> Atualizado em 05/06/2026 · Claude Sonnet 4.6 via MCP · Diagnóstico Massivo v2 — Stack 7/7 ✅

---

## 🎯 Objetivos Atuais

- **IMEDIATO:** `git push origin main` no Termux (15 arquivos modificados, 2 untracked principais)
- **IMEDIATO:** Re-indexar RAG — 3 arquivos novos desde cache_v2 (Guia_Ativacao, estabilizacao_mestre, resumo_06-03)
- **PRÓXIMO:** Resolver Gemini quota HTTP 429 — KNOWLEDGE_QUERY/CREATIVE_TASK retornam "Sem dados"
- **PRÓXIMO:** Configurar TTS engine no Android (termux-tts-speak falhando silenciosamente)

---

## 📋 Backlog

### 🔧 Infraestrutura
- [ ] **Cron para consolidação RAG** · `0 23 * * * node .../consolidate_rag.js`
- [ ] **Cron para re-indexação vetorial** · semanal após consolidação
- [ ] **Escopo `read:storage` dedicado** · `bridge_permissions.json` v1.2
- [ ] **Filtro temporal no RAG** · memórias recentes com peso maior
- [ ] **hub_pwa versao** · sincronizar server.js version com app.js (ambos em v1.0.3)
- [ ] **hub_pwa /hub/services** · adicionar svc-hub (5555) ao health check próprio
- [ ] **MCP: registrar android_bridge como tool** · expor /bridge/* como MCP tool diretamente

### 🤖 Agente Local
- [ ] **Gemini quota** · Verificar reset diário ou upgrade de plano. KNOWLEDGE_QUERY/CREATIVE_TASK não funcionam sem Gemini
- [ ] **Fallback local para KNOWLEDGE_QUERY** · quando cloud falha, usar Qwen + RAG em vez de "Sem dados"
- [ ] **TTS** · `termux-tts-speak` falha silenciosamente — verificar engine TTS no Android (Configurações > Acessibilidade > TTS)

### 👎 App Nativo (Plano Mestre)
- [ ] **Fase 1** · Interface nativa Android substituindo bot Telegram
- [ ] **Fase 2** · SQLite persistence + histórico de conversações

---

## 🔨 Em Progresso

- [ ] **git push origin main** · Necessário no Termux (rede externa bloqueada via MCP)
- [ ] **Re-indexação RAG** · 3 arquivos novos aguardando: Guia_Ativacao_Servicos.md, 2026-06-02_estabilizacao_mestre.md, 2026-06-03_resumo.md

---

## ✅ Concluído

### 05/06/2026 — Diagnóstico Massivo v2 (Claude Sonnet 4.6)
- [x] **Stack 7/7 validado** · llama-server, MCP, workspace_agent, API REST, agente local, bridge, hub_pwa — todos ONLINE. (Claude, 05/06/2026)
- [x] **Intent routing 8/8** · todos os TOOL_CALL intents roteando `tool_direct` corretamente. (Claude, 05/06/2026)
- [x] **Bridge READ validada** · battery (75%, CHARGING, 28°C) + wifi (Família Moreno, 351Mbps) funcionando. (Claude, 05/06/2026)
- [x] **RAG cache_v2** · 994 chunks indexados, 20MB, criado 02/06. cache_v1: 334 docs MiniSearch. (Claude, 05/06/2026)
- [x] **Limpeza scripts temporários** · 7 arquivos de debug removidos de Scripts/core. (Claude, 05/06/2026)
- [x] **Pasta Workspace/ fantasma removida** · /sdcard/Workspace/Workspace/ deletada. (Claude, 05/06/2026)
- [x] **4 documentos RAG atualizados** · Guia_Ativacao_Servicos, erros_conhecidos, decisoes_tecnicas, resumo 06-03. (Claude, 05/06/2026)

### 03/06/2026 — SSID Fix + pip3 + Documentação (Claude Sonnet 4.6)
- [x] **hub_pwa app.js v1.0.3** · Fix SSID `<unknown ssid>` + remove truncagem + CORS proxy. (Claude, 03/06/2026)
- [x] **python-numpy 2.4.4** · pkg install. (Claude, 03/06/2026)
- [x] **python-pillow 12.2.0** · pkg install. (Claude, 03/06/2026)

### 02/06/2026 — Estabilização Mestre (Claude Sonnet 4.6)
- [x] **Bug #1** · executor.js regex fork-bomb falso positivo corrigido. (Claude, 02/06/2026)
- [x] **Bug #4** · 03_start_services.sh path HUB corrigido. (Claude, 02/06/2026)
- [x] **index_cerebro.py** · timeout 45s + retry 3x. (Claude, 02/06/2026)
- [x] **Stack 6/6 → 7/7** · hub_pwa restaurado. (Claude, 02/06/2026)

### 01/06/2026 — FASE 6 + Gatekeeper Fix
- [x] **android_bridge.js** · porta 4444 + zero-trust + audit. (Claude, 01/06/2026)
- [x] **Hub PWA** · server.js (5555) + PWA completo. (Claude, 01/06/2026)
- [x] **ollama_agent.js v2.2.0** · gatekeeper auto-refresh 28min. (Claude, 01/06/2026)
- [x] **Cloud-First KNOWLEDGE/CREATIVE** · Gemini direto. (Claude, 01/06/2026)

### FASES 0–5 — Fundação Completa
- [x] llama-server + Qwen 0.5B Q4_K_M — migrado de Ollama
- [x] workspace_agent_server.js (3333)
- [x] working_memory.js + pipeline completo
- [x] cloud_bridge.js + Gemini fallback
- [x] Git remoto GitHub + DevTools v2.2
- [x] API REST (4000) + Bearer Token
- [x] Bot Telegram Chronos v4
- [x] vector_db_v2.js + embeddings
