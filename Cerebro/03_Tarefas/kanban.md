# Kanban do Workspace Mobile

> Atualizado em 31/05/2026 · Sessão Claude · ollama_agent.js v2.1.0 — 3 bugs corrigidos (tool_error_guard + quality_filter_v2)

---

## 🎯 Objetivos Atuais
- **IMEDIATO**: Reiniciar agente local (porta 4001) para carregar ollama_agent.js v2.1.0
- Reiniciar llama-server com `--pooling mean` e reindexar com `vector_db_v2.js`
- Ativar `ANTHROPIC_API_KEY` no `.env` para ligar o cloud_bridge (FASE 3)
- Validar Antigravity e Manus.IA no workspace_agent (porta 3333)
- Iniciar Milestone 4: App React Native (FASE 5)

---

## 📋 Backlog

### 🧠 FASE 4 — Melhorias de memória
- [ ] **Reindexar com `vector_db_v2.js` após restart** · `node -e "import('./Scripts/core/vector_db_v2.js').then(m=>m.indexCerebro())"` no Termux. Cria `.vector_cache_v2.json` com vetores reais de 896 dims.
- [ ] **Filtro de data e decaimento temporal no RAG** · Memórias recentes com peso maior. Decaimento configurável.
- [ ] **Hierarquia formal de memória** · Formalizar promoção: working_memory (sessão) → Memoria-RAG (7 dias) → Cerebro/02_Memoria (longo prazo). Criar `Cerebro/05_Conhecimento/` para documentação permanente.
- [ ] **Limpeza periódica do Memoria-RAG** · Script de consolidação diária que agrega `wm_*.json` em um resumo único por dia (já tem o `2026-05-31_consolidated.json` como referência).

### 📱 FASE 5 — Milestone 4: App React Native
> Iniciar após validação end-to-end FASE 1+2 em produção.
- [ ] **Inicializar projeto React Native via DevTools.**
- [ ] **Desenvolver estrutura básica** · Componentes, navegação.
- [ ] **Interface de chat conversacional.**
- [ ] **Integrar com llama-server local** · HTTP porta 11434.
- [ ] **Ativação de ferramentas por linguagem natural no App.**
- [ ] **Integrar com API REST interna** · Porta 4000, Bearer Token.
- [ ] **Backup, banco de dados local e testes.**

---

## 🔨 Em Progresso

- [ ] **Reiniciar agente local** · `pkill -f ollama_agent` depois `nohup node Scripts/core/ollama_agent.js > Logs/agent.log 2>&1 &` no Termux para carregar v2.1.0.
- [ ] **Reiniciar llama-server com `--pooling mean`** · `ws-restart` no Termux — BLOQUEADOR da FASE 4 vetorial.
- [ ] **Reindexar Cerebro com vetores reais** · Após restart, rodar `vector_db_v2.js indexCerebro()`. Vai criar `.vector_cache_v2.json`.
- [ ] **Adicionar `ANTHROPIC_API_KEY` ao `.env`** · Único bloqueador do cloud_bridge (FASE 3).
- [ ] **Git push para GitHub** · Commit local pendente de push.
- [ ] **Validar acesso de Antigravity ao workspace_agent** · Porta 3333, teste end-to-end.
- [ ] **Validar acesso de Manus.IA ao workspace_agent** · Idem Manus.

---

## ✅ Concluído

### FASE 4 — Embeddings e RAG Vetorial
- [x] **`vector_db_v2.js` implementado** · Modo vetorial (primário) + MiniSearch (fallback). Indexação incremental por mtime. Cache em `.vector_cache_v2.json`. (31/05/2026)
- [x] **`context_builder.js` migrado para vectorSearch** · Busca semântica via `vector_db_v2.js`, toda a cadeia async/await. RAG blacklist para 00_Sistema e 01_Planejamento. (31/05/2026)
- [x] **`ollama_agent.js` v2.1.0** · 3 bugs corrigidos: tool_error_guard (Bug2), quality_filter_v2 com detecção emocional/JSON (Bug3), identity_check via shell inline sem Python (Bug1 já estava no registry v2.7.0). (Claude, 31/05/2026)
- [x] **`start_llama_server.sh` v2.1** · `--embeddings --pooling mean` — correção crítica do erro de pooling Qwen 0.5B. (Claude, 31/05/2026)
- [x] **`03_start_services.sh` v2.1** · Sincronizado com `--embeddings --pooling mean`. Check de embeddings no `--status`. (Claude, 31/05/2026)

### FASE 0 — Limpeza e base
- [x] **Remover Ollama e dependências residuais** · RAM liberada. (30/05/2026)
- [x] **Validar llama-server com Qwen 0.5B Q4_K_M** · Operacional: porta 11434, ctx 1024, ~12 tok/s, RAM ≤ 1GB. (30/05/2026)
- [x] **Ativar zRAM / swap** · Script `00_zram_setup.sh` criado. Android já possui 2.7GB de swap nativo. Sem root — swapon bloqueado. Stack estável com swap nativo. (31/05/2026)

### FASE 1 — workspace_agent: servidor MCP universal
- [x] **Criar `workspace_agent_server.js`** · 9 rotas, porta 3333. Implementado e testado. (30/05/2026)
- [x] **Todas as rotas de filesystem e execução** · `read_file`, `write_file`, `append_file`, `delete_file`, `move_file`, `list_dir`, `run_script`, `shell_exec`, `apply_patch`. (30/05/2026)
- [x] **Registrar no `tool_registry.json`** · v2.7.0 · identity_check corrigido: shell inline sem arquivo externo. (30/05/2026)
- [x] **Adicionar ao bootstrap** · `03_start_services.sh` atualizado: serviço [2/5]. (31/05/2026)
- [x] **Validar acesso de Claude ao workspace_agent** · Testado end-to-end. (31/05/2026)

### FASE 2 — Qwen 0.5B como executor
- [x] **`workspace_agent_qwen_executor.js`** · Bypass para payloads estruturados, Qwen para linguagem natural. (30/05/2026)
- [x] **`working_memory.js`** · startTask/completeStep/finishTask, arquivamento na Memoria-RAG. (30/05/2026)
- [x] **Ciclo end-to-end validado** · Dispatch, tool call, synthesis, working memory — 63 tarefas testadas em produção. (31/05/2026)

### FASE 3 — Arquitetura do Enxame
- [x] **`cloud_bridge.js`** · `consultExpertIA()`, custo-controle (20 calls/dia), multi-backend. (30/05/2026)
- [x] **`agent_rules.json`** · Retry policy, delegation_rules, cost_control. (30/05/2026)
- [x] **`consult_expert_ia` no tool_registry** · v2.3.0. (30/05/2026)
- [x] **Retry 2× + fallback automático** · `ollama_agent.js` v2.0.0. (31/05/2026)

### Concluídos anteriores
- [x] **Personalização Robusta do Chronos Local** · Identidade, saúde real e perfil. (30/05/2026)
- [x] **Migração LLM** · Ollama → llama-server (Qwen 2.5 0.5B Q4_K_M). (30/05/2026)
- [x] **Milestones 0, 1, 2 e 3 COMPLETOS.**
- [x] Git Remoto ativado + sincronização com GitHub.
- [x] DevTools v2.2 (Git, NPM, Python).
- [x] API REST (porta 4000) com Bearer Token.
