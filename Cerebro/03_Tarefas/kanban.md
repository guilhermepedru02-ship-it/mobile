# Kanban do Workspace Mobile

> Atualizado em 01/06/2026 · Claude Sonnet 4.6 via MCP · Pós-refinamentos + diagnóstico massivo completo

---

## 🎯 Objetivos Atuais

- **IMEDIATO:** `git push origin main` no Termux para sincronizar GitHub
- **IMEDIATO:** `node Scripts/core/consolidate_rag.js` ao fim de cada dia
- Aguardar reset de quota do Gemini (meia-noite) para testar fallback cloud
- Decidir: evoluir Qwen para classificador puro (sem síntese) vs manter arquitetura atual
- Iniciar Milestone 4: App React Native (FASE 5)

---

## 📋 Backlog

### 🧠 Arquitetura — Refinamentos Futuros
- [ ] **Tornar Qwen exclusivamente classificador** · Remover toda síntese LLM do ollama_agent para KNOWLEDGE_QUERY. Retornar mensagem padrão + acionar cloud automaticamente. Elimina 100% das alucinacões.
- [ ] **Consolidacão RAG automática via cron** · Adicionar ao bootstrap: `0 23 * * * node /storage/emulated/0/Workspace/Scripts/core/consolidate_rag.js` no crontab do Termux.
- [ ] **Reindexar com vector_db_v2.js** · Após ws-restart, rodar indexacão completa. O cache v2 (23KB) está muito menor que o v1 (409KB) — indica indexacão parcial.
- [ ] **Filtro de data e decaimento temporal no RAG** · Memórias recentes com peso maior.
- [ ] **Remover pasta `Workspace/` fantasma** · Foi criada por erro de path no teste do workspace_agent. Limpar: `rm -rf /storage/emulated/0/Workspace/Workspace/`

### 📱 FASE 5 — Milestone 4: App React Native
- [ ] Inicializar projeto React Native via DevTools
- [ ] Estrutura básica: componentes, navegação
- [ ] Interface de chat conversacional
- [ ] Integrar com llama-server local (porta 11434)
- [ ] Integrar com API REST interna (porta 4000, Bearer Token)
- [ ] Ativacão de ferramentas por linguagem natural no App
- [ ] Backup, banco de dados local e testes

---

## 🔨 Em Progresso

- [ ] **git push origin main** · Commit `82a8877` pronto localmente. Push manual no Termux.
- [ ] **Quota Gemini** · GEMINI_API_KEY ok, quota do plano gratuito esgotada. Reset automático à meia-noite.
- [ ] **Validar Antigravity e Manus.IA no workspace_agent** · Porta 3333, teste end-to-end pendente.

---

## ✅ Concluído

### 01/06/2026 — Refinamentos + Diagnóstico Massivo
- [x] **Diagnóstico massivo completo** · 7/7 servicos verdes. API REST (4000) recuperada. Avaliação arquitetural honesta documentada na RAG. (Claude, 01/06/2026)
- [x] **`.gitignore` expandido** · wm_*.json, vector_cache_v2, debug files, obsidian state. Repositório limpo. (Claude, 01/06/2026)
- [x] **`consolidate_rag.js` criado e executado** · 129 wm_*.json → 2 _consolidated.md. Script reutilizável para uso diário. (Claude, 01/06/2026)
- [x] **`context_builder.js` v2.2.0** · Removidos tags [CTX]...[/CTX]. System prompt <300 tokens. RAG prioriza _consolidated.md. (Claude, 01/06/2026)
- [x] **Documentação RAG completa da sessão** · 3 documentos criados: avaliacao_arquitetural, diagnostico_qwen_limites, guia_claude_desenvolvimento. (Claude, 01/06/2026)

### 31/05/2026 — Bug Fixes + dispatch
- [x] **`ollama_agent.js` v2.1.0** · 3 bugs: tool_error_guard + quality_filter_v2 + identity_check shell inline. (Claude, 31/05/2026)
- [x] **`dispatch.js` v2.1.0** · keywordMatches() com exact/boundary/includes em cascata. (Claude, 31/05/2026)
- [x] **`bot.js` migrado para Gemini** · askClaude() → askGemini(), /status e /ia corrigidos. (Claude, 31/05/2026)
- [x] **Documentação atualizada** · README, decisoes_tecnicas, kanban. (Claude, 31/05/2026)

### FASE 4 — Embeddings e RAG Vetorial
- [x] **`vector_db_v2.js`** · Vetorial (primário) + MiniSearch (fallback). Cache incremental. (31/05/2026)
- [x] **`context_builder.js` migrado** · Busca semântica via vector_db_v2.js. (31/05/2026)
- [x] **`start_llama_server.sh` v2.1** · `--embeddings --pooling mean`. (31/05/2026)

### FASES 0-3 — Fundacão
- [x] Remover Ollama, validar llama-server + Qwen 0.5B Q4_K_M
- [x] workspace_agent_server.js (porta 3333, 9 rotas)
- [x] working_memory.js + ollama_agent.js pipeline completo
- [x] cloud_bridge.js + agent_rules.json + retry/fallback
- [x] Git remoto GitHub + DevTools v2.2
- [x] API REST (porta 4000) + Bearer Token
- [x] Bot Telegram completo
- [x] Milestones 0, 1, 2 e 3 COMPLETOS
