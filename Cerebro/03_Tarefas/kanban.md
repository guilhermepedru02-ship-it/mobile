# Kanban do Workspace Mobile

> Atualizado em 30/05/2026 · Análise Massiva + zRAM + silent_execution implementados via sessão Claude.

---

## 🎯 Objetivos Atuais
- Implementar o `workspace_agent` como ferramenta MCP universal acessível por todas as IAs. ✅ FASE 1 completa
- Configurar Qwen 0.5B Q4 como executor local de micro-tarefas supervisionadas. ✅ FASE 2 arquivos criados
- Implementar a Arquitetura do Enxame (`consult_expert_ia`) com gerente de custos. ✅ FASE 3 implementada
- Solidificar a hierarquia de memória antes de retomar o Milestone 4.
- Manter soberania de dados e eficiência do sistema Android.

---

## 📋 Backlog

### 🧹 FASE 0 — Limpeza e base
- [x] **Ativar zRAM no Android** · Script `00_zram_setup.sh` criado com suporte a root (zRAM 1GB lz4) e sem root (swapfile 512MB). Executar manualmente no Termux: `bash Scripts/bootstrap/00_zram_setup.sh` (Claude, 30/05/2026)

### 🔌 FASE 1 — workspace_agent: servidor MCP universal
- [x] **Criar `workspace_agent_server.js`** · Servidor HTTP local na porta 3333. (Claude, 30/05/2026)
- [x] **Implementar rota `read_file`** (Claude, 30/05/2026)
- [x] **Implementar rota `run_script`** (Claude, 30/05/2026)
- [x] **Implementar rota `shell_exec`** (Claude, 30/05/2026)
- [x] **Implementar rota `apply_patch`** (Claude, 30/05/2026)
- [x] **Implementar rotas de filesystem** · `write_file`, `move_file`, `delete_file`, `list_dir` (Claude, 30/05/2026)
- [x] **Registrar `workspace_agent` no `tool_registry.json`** · v2.3.0, campo `mcp_servers`. (Claude, 30/05/2026)
- [x] **Adicionar `workspace_agent_server.js` ao bootstrap** · Serviço [2/5] no `03_start_services.sh`. (Claude, 30/05/2026)
- [x] **Documentar protocolo de payload e resposta** · `documentação/workspace_agent_protocol.md`. (Claude, 30/05/2026)
- [x] **Validar acesso de Claude ao `workspace_agent`** · Prova real: sessão Claude 30/05/2026 leu/escreveu arquivos sem erros. ✅ CONFIRMADO
- [ ] **Validar acesso de Antigravity ao `workspace_agent`** · Guilherme fará.
- [ ] **Validar acesso de Manus.IA ao `workspace_agent`** · Guilherme fará.

### 🤖 FASE 2 — Qwen 0.5B como executor do workspace_agent
- [x] **`workspace_agent_qwen_executor.js` criado** · Bypass para payloads estruturados, Qwen para linguagem natural. (Claude, 30/05/2026)
- [x] **`working_memory.js` criado e integrado** · startTask/completeStep/finishTask funcionando. (Claude, 30/05/2026)
- [x] **Política de uso do Qwen definida** · Documentada no `workspace_agent_qwen_executor.js` (Claude, 30/05/2026)
- [ ] **Testar ciclo completo supervisor-auxiliar** · Simular tarefa complexa: IA externa planeja → delega micro-tarefas → Qwen executa → IA valida → avança.
- [ ] **Reiniciar `ollama_agent.js` e validar personalização do Chronos Local** · `cd Scripts/core && node ollama_agent.js`

### 🪥 FASE 3 — Arquitetura do Enxame (consult_expert_ia)
- [x] **`cloud_bridge.js` criado** · consultExpertIA, controle de custos, multi-backend. (Claude, 30/05/2026)
- [x] **`agent_rules.json` criado** · Retry policy, delegation_rules, cloud_backends, cost_control. (Claude, 30/05/2026)
- [x] **`agent_rules.json` v1.1.0** · `silent_execution.enabled` ativado para true. (Claude, 30/05/2026)
- [x] **Ferramenta `consult_expert_ia` no `tool_registry.json`** · v2.3.0, entrada em `tools` + `mcp_servers`. (Claude, 30/05/2026)
- [x] **Lógica de retry no `ollama_agent.js`** · Máximo 2 tentativas locais + fallback automático para cloud_bridge. (Claude, 30/05/2026)
- [x] **`silent_execution` ativado** · `enabled: true` no agent_rules.json v1.1.0 (Claude, 30/05/2026)
- [ ] **Configurar ANTHROPIC_API_KEY no .env** · Guilherme deve definir a variável para ativar o fallback cloud.
- [ ] **Testar ciclo completo: local fail → cloud fallback** · Derrubar llama-server e verificar se cloud_bridge responde.

### 🧠 FASE 4 — Melhorias de memória
- [x] **Hierarquia de memória: Curto Prazo (Working Memory)** · `working_memory.js` implementado. (Claude, 30/05/2026)
- [x] **Hierarquia de memória: Médio Prazo (RAG)** · Memoria-RAG funcional com chunking semântico. (Claude, 30/05/2026)
- [x] **Hierarquia de memória: Longo Prazo (Cérebro)** · Obsidian Vault em Cerebro/. (Guilherme, base)
- [x] **MiniSearch (vector_db.js) integrado no context_builder.js** · Busca semântica com fallback para RAG recente. (Claude, 30/05/2026)
- [x] **`decisoes_tecnicas.md` criado e populado** · Todas as decisões da sessão documentadas. (Claude, 30/05/2026)
- [ ] **Embeddings vetoriais via `/v1/embeddings`** · Substituir MiniSearch por true embeddings quando hardware permitir.
- [ ] **Filtro de data no RAG** · Decaimento temporal configurável.
- [ ] **Reindexar Cerebro** · `node -e "import('./Scripts/core/vector_db.js').then(m => m.indexCerebro())"` no Termux.

### 📱 FASE 5 — Milestone 4: App React Native (com nova arquitetura)
> Só iniciar após FASE 1 e FASE 2 validadas em prod.
- [ ] **Inicializar projeto React Native via DevTools.**
- [ ] **Desenvolver estrutura básica do app** · Componentes, navegação.
- [ ] **Implementar interface de chat conversacional.**
- [ ] **Integrar comunicação com llama-server local** · Via HTTP, porta do llama-server.
- [ ] **Implementar ativação de ferramentas via linguagem natural no App.**
- [ ] **Integrar com API REST interna** · Porta 4000, autenticação Bearer Token.
- [ ] **Backup, banco de dados local e testes.**

---

## 🔨 Em Progresso (Guilherme executa no Termux)
- [ ] **Executar zRAM** · `bash Scripts/bootstrap/00_zram_setup.sh` — script pronto, aguarda execução manual.
- [ ] **Configurar ANTHROPIC_API_KEY no .env** · Requerido para cloud fallback funcionar.
- [ ] **Reiniciar `ollama_agent.js` v2.0.0** · `cd Scripts/core && node ollama_agent.js`
- [ ] **Reindexar o Cérebro** · `node -e "import('./Scripts/core/vector_db.js').then(m => m.indexCerebro())"`
- [ ] **Git commit desta sessão** · zRAM script + agent_rules v1.1.0 + decisoes_tecnicas.md
- [ ] **Testar ciclo completo supervisor-auxiliar** · FASE 2 validação.
- [ ] **Validar acesso Antigravity/Manus.IA** · Guilherme fará.

---

## ✅ Concluído
- [x] **FASE 0: Script zRAM criado** · `Scripts/bootstrap/00_zram_setup.sh` — root e sem-root. (Claude, 30/05/2026)
- [x] **FASE 3: silent_execution ativado** · agent_rules.json v1.1.0 (Claude, 30/05/2026)
- [x] **FASE 4: decisoes_tecnicas.md** · Memória de longo prazo documentada. (Claude, 30/05/2026)
- [x] **FASE 3: cloud_bridge.js implementado** · consultExpertIA, cost_control, multi-backend Anthropic. (Claude, 30/05/2026)
- [x] **FASE 3: agent_rules.json criado** · retry_policy, delegation_rules, cost_control. (Claude, 30/05/2026)
- [x] **FASE 3: ollama_agent.js v2.0.0** · Retry 2× + fallback automático para cloud. (Claude, 30/05/2026)
- [x] **FASE 3: tool_registry.json v2.3.0** · consult_expert_ia + cloud_bridge como mcp_server. (Claude, 30/05/2026)
- [x] **FASE 4: context_builder.js com MiniSearch** · Busca semântica integrada. (Claude, 30/05/2026)
- [x] **FASE 1: workspace_agent_server.js implementado** · v1.0.0, 9 rotas, porta 3333, bootstrap integrado, documentado. (Claude, 30/05/2026)
- [x] **Validação Claude → workspace_agent** · Sessão real prova leitura/escrita de arquivos funcionando. (Claude, 30/05/2026)
- [x] **Git commit — 108 arquivos** · Todas as sessões do dia 30/05/2026 versionadas. (Claude, 30/05/2026)
- [x] **Remover Ollama e todas as dependências residuais** (30/05/2026)
- [x] **Validar llama-server com Qwen 0.5B Q4_K_M** (30/05/2026)
- [x] **Personalização Robusta do Chronos Local** (Claude, 30/05/2026)
- [x] **Arquitetura do Mini-Agente documentada no diário** (Claude, 30/05/2026)
- [x] **Chunking Semântico** no `context_builder.js`.
- [x] **Análise Massiva do Sistema** (Manus, 30/05/2026).
- [x] **Alinhamento do Cérebro** · Notas e protocolos atualizados para llama-server (Qwen 2.5).
- [x] **Migração LLM COMPLETA** · Ollama → llama-server (Qwen 2.5).
- [x] **Milestones 0, 1, 2 e 3 COMPLETOS.**
- [x] Ativação do Git Remoto e sincronização com GitHub.
- [x] DevTools v2.2 (Git, NPM, Python).
- [x] API REST (porta 4000) com autenticação Bearer Token.
