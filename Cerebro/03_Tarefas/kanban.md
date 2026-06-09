# Kanban do Workspace Mobile

> Atualizado em 08/06/2026 · Antigravity via MCP · TTS e Fallback NVIDIA Online ✅

---

## 🎯 Objetivos Atuais

- **IMEDIATO:** `git push origin main` no Termux (15 arquivos modificados, 2 untracked principais)
- **IMEDIATO:** Re-indexar RAG — 3 arquivos novos desde cache_v2 (Guia_Ativacao, estabilizacao_mestre, resumo_06-03)

---

## 📋 Backlog

### 🔧 Infraestrutura
- [ ] **Cron para consolidação RAG** · `0 23 * * * node .../consolidate_rag.js`
- [ ] **Cron para re-indexação vetorial** · semanal após consolidação
- [ ] **Automação IoT Infravermelho** · usar `termux-infrared-transmit`
- [ ] **Escopo `read:storage` dedicado** · `bridge_permissions.json` v1.2
- [ ] **Filtro temporal no RAG** · memórias recentes com peso maior
- [ ] **hub_pwa versao** · sincronizar server.js version com app.js (ambos em v1.0.3)
- [ ] **hub_pwa /hub/services** · adicionar svc-hub (5555) ao health check próprio
- [ ] **MCP: registrar android_bridge como tool** · expor /bridge/* como MCP tool diretamente

### 📱 App Nativo (Plano Mestre)
- [ ] **Fase 1** · Interface nativa Android substituindo bot Telegram
- [ ] **Fase 2** · SQLite persistence + histórico de conversações

---

## 🔨 Em Progresso

- [ ] **git push origin main** · Necessário no Termux (rede externa bloqueada via MCP)
- [ ] **Re-indexação RAG** · 3 arquivos novos aguardando: Guia_Ativacao_Servicos.md, 2026-06-02_estabilizacao_mestre.md, 2026-06-03_resumo.md

---

## ✅ Concluído

### 08/06/2026 — TTS Fix e NVIDIA Fallback
- [x] **TTS** · Problema de falha silenciosa resolvido. O sistema de voz do Chronos agora está 100% operacional no volume máximo.
- [x] **Limpeza Gemini/Claude** · Removido de agent_rules, cloud_bridge, bot.js e .env.
- [x] **Diagnóstico Massivo v3** · 45 sensores mapeados, 37 APIs Termux, stack validado.

### 05/06/2026 — Diagnóstico Massivo v2 (Claude Sonnet 4.6)
- [x] **Stack 7/7 validado** · llama-server, MCP, workspace_agent, API REST, agente local, bridge, hub_pwa — todos ONLINE.
- [x] **Intent routing 8/8** · todos os TOOL_CALL intents roteando `tool_direct` corretamente.
- [x] **Bridge READ validada** · battery (75%, CHARGING, 28°C) + wifi (Família Moreno, 351Mbps) funcionando.
- [x] **RAG cache_v2** · 994 chunks indexados, 20MB, criado 02/06. cache_v1: 334 docs MiniSearch.
- [x] **Limpeza scripts temporários** · 7 arquivos de debug removidos de Scripts/core.
- [x] **Pasta Workspace/ fantasma removida** · /sdcard/Workspace/Workspace/ deletada.
- [x] **4 documentos RAG atualizados** · Guia_Ativacao_Servicos, erros_conhecidos, decisoes_tecnicas, resumo 06-03.
