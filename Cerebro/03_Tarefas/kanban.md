# Kanban do Workspace Mobile

> Atualizado em 02/06/2026 · Claude Sonnet 4.6 via MCP · Diagnóstico Massivo + Indexação Vetorial v1.1 + Hub PWA restaurado

---

## 🎯 Objetivos Atuais

- **IMEDIATO:** `git push origin main` no Termux (commits acumulados há várias sessões)
- **IMEDIATO:** Aguardar conclusão da indexação vetorial em background (index_cerebro.py v1.1)
- **PRÓXIMO:** Testar `/local o que é RAG?` → deve responder via Gemini (cloud-first)
- **PRÓXIMO:** Validar busca semântica com `.vector_cache_v2.json` após indexação
- `node Scripts/core/consolidate_rag.js` ao fim de cada dia (já feito hoje)

---

## 📋 Backlog

### 🔌 FASE 6 — Validação e Evolução
- [ ] **6.1.2 — Testes ao vivo com Claude via MCP** · Chamar `/bridge/battery` e `/bridge/wifi` via MCP
- [ ] **6.1.3 — Validar auditoria** · Verificar `Logs/android-bridge-audit.log` após testes
- [ ] **6.1.4 — Validação semana 1** · Manter READ ativo por 7 dias antes de habilitar WRITE automático

### 🧠 Arquitetura — Refinamentos Futuros
- [ ] **Consolidação RAG automática via cron** · `0 23 * * * node .../consolidate_rag.js`
- [ ] **Filtro de data e decaimento temporal no RAG** · Memórias recentes com peso maior
- [ ] **Remover pasta `Workspace/` fantasma** · `rm -rf /storage/emulated/0/Workspace/Workspace/`
- [ ] **Escopo `read:storage` dedicado** · `bridge_permissions.json` v1.1
- [ ] **hub_pwa node_modules** · Criar package.json próprio ou mover para Scripts/core/

---

## 🔨 Em Progresso

- [ ] **git push origin main** · Necessário no Termux (rede externa bloqueada no MCP)
- [ ] **Indexação vetorial .vector_cache_v2.json** · Rodando em background (PID 10437)
- [ ] **Validar Termux:API F-droid** · Confirmar termux-battery/wifi via bridge após migração

---

## ✅ Concluído

### 02/06/2026 — Diagnóstico Massivo + Indexação Vetorial (Claude Sonnet 4.6)
- [x] **Diagnóstico visual completo** · Saúde RAM/Swap/Disk/Load + inventário de serviços e memória. (Claude, 02/06/2026)
- [x] **Eliminados 2 processos zombie** · test_embeddings.mjs PIDs 2770/3288 → liberados ~200MB RAM. (Claude, 02/06/2026)
- [x] **index_cerebro.py v1.1 corrigido** · Bug crítico: 00_Sistema e 01_Planejamento removidos da indexação (violavam RAG blacklist). 53 arquivos válidos identificados. (Claude, 02/06/2026)
- [x] **Indexação vetorial iniciada** · 53 arquivos × ~500 chunks estimados. Roda em background via nohup. (Claude, 02/06/2026)
- [x] **RAG consolidado** · 5 wm_*.json de 02/06 → 2026-06-02_consolidated.md. (Claude, 02/06/2026)
- [x] **hub_pwa restaurado** · node_modules copiados, servidor rodando em :5555. (Claude, 02/06/2026)
- [x] **Stack verificado** · 8 serviços operacionais pós-limpeza de zombies. (Claude, 02/06/2026)

### 01/06/2026 — Fix Gatekeeper + Cloud-First (Claude Sonnet 4.6)
- [x] **`ollama_agent.js` v2.2.0** · ensureGatekeeperUnlocked() auto-refresh 28min. (Claude, 01/06/2026)
- [x] **Cloud-First KNOWLEDGE/CREATIVE** · Gemini direto, Qwen apenas ferramentas. (Claude, 01/06/2026)

### 01/06/2026 — FASE 6: Android Bridge Gateway
- [x] **`bridge_permissions.json` v1.0.0** (Claude, 01/06/2026)
- [x] **`bridge_audit.js` v1.0.0** (Claude, 01/06/2026)
- [x] **`bridge_middleware.js` v1.0.0** (Claude, 01/06/2026)
- [x] **`android_bridge.js` v1.0.0** · Porta 4444. (Claude, 01/06/2026)
- [x] **`Projetos/hub_pwa/`** · server.js (5555) + PWA completo. (Claude, 01/06/2026)
- [x] **Bridge validada ao vivo** · battery ✔️ | wifi ✔️ | clipboard DENIED ✔️. (Guilherme, 01/06/2026)
- [x] **Bootstrap v3.0** · 8 serviços. (Claude, 01/06/2026)

### 01/06/2026 — Diagnóstico Massivo + Refinamentos
- [x] **7/7 serviços verdes** (Claude, 01/06/2026)
- [x] **dispatch.js v2.1.0** (Claude, 01/06/2026)
- [x] **context_builder.js v2.2.0** (Claude, 01/06/2026)
- [x] **ollama_agent.js v2.1.0** (Claude, 01/06/2026)
- [x] **consolidate_rag.js** · 129 wm_*.json consolidados. (Claude, 01/06/2026)
- [x] **Bot Telegram** · Migrado Anthropic → Gemini. (Claude, 01/06/2026)

### 31/05/2026 — Vector DB v2 + Embeddings
- [x] **vector_db_v2.js** (Claude, 31/05/2026)
- [x] **start_llama_server.sh v2.1** · ubatch=512. (Claude, 31/05/2026)

### FASES 0-5 — Fundação Completa
- [x] Remover Ollama, validar llama-server + Qwen 0.5B Q4_K_M
- [x] workspace_agent_server.js (3333)
- [x] working_memory.js + pipeline completo
- [x] cloud_bridge.js + Gemini fallback
- [x] Git remoto GitHub + DevTools v2.2
- [x] API REST (4000) + Bearer Token
- [x] Bot Telegram completo
- [x] Milestones 0, 1, 2, 3 e 4 COMPLETOS
