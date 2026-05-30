# Kanban do Workspace Mobile

> Atualizado em 30/05/2026 via sessão Claude · FASE 1 workspace_agent implementada. Git commit: 108 arquivos.

---

## 🎯 Objetivos Atuais
- Implementar o `workspace_agent` como ferramenta MCP universal acessível por todas as IAs. ✅ FASE 1 completa
- Configurar Qwen 0.5B Q4 como executor local de micro-tarefas supervisionadas.
- Implementar a Arquitetura do Enxame (`consult_expert_ia`) com gerente de custos.
- Solidificar a hierarquia de memória antes de retomar o Milestone 4.
- Manter soberania de dados e eficiência do sistema Android.

---

## 📋 Backlog

### 🧹 FASE 0 — Limpeza e base
- [ ] **Ativar zRAM no Android** · Configurar swap comprimido para ampliar memória disponível ao llama-server e ao workspace_agent.

### 🔌 FASE 1 — workspace_agent: servidor MCP universal
- [x] **Criar `workspace_agent_server.js`** · Servidor HTTP local na porta 3333. (Claude, 30/05/2026)
- [x] **Implementar rota `read_file`** (Claude, 30/05/2026)
- [x] **Implementar rota `run_script`** (Claude, 30/05/2026)
- [x] **Implementar rota `shell_exec`** (Claude, 30/05/2026)
- [x] **Implementar rota `apply_patch`** (Claude, 30/05/2026)
- [x] **Implementar rotas de filesystem** · `write_file`, `move_file`, `delete_file`, `list_dir` (Claude, 30/05/2026)
- [x] **Registrar `workspace_agent` no `tool_registry.json`** · v2.2.0, campo `mcp_servers`. (Claude, 30/05/2026)
- [x] **Adicionar `workspace_agent_server.js` ao bootstrap** · Serviço [2/5] no `03_start_services.sh`. (Claude, 30/05/2026)
- [x] **Documentar protocolo de payload e resposta** · `documentação/workspace_agent_protocol.md`. (Claude, 30/05/2026)
- [ ] **Validar acesso de Claude ao `workspace_agent`** · Teste end-to-end: Claude chama `read_file`, recebe conteúdo, avança na tarefa. **PRÓXIMA SESSÃO**
- [ ] **Validar acesso de Antigravity ao `workspace_agent`** · Mesmo teste com Antigravity para confirmar universalidade.
- [ ] **Validar acesso de Manus.IA ao `workspace_agent`** · Idem com Manus.

### 🤖 FASE 2 — Qwen 0.5B como executor do workspace_agent
- [ ] **Integrar Qwen 0.5B como motor do `workspace_agent`** · O servidor recebe a instrução JSON, passa para o Qwen formatar/confirmar a ação e executa. Para operações determinísticas simples, o Qwen pode ser bypassado (exec direto).
- [ ] **Definir política de uso do Qwen no agente** · Qwen interpreta instruções ambíguas; para comandos claros (`read_file` + path), execução direta sem LLM para economizar RAM e tempo.
- [ ] **Testar ciclo completo supervisor-auxiliar** · Simular tarefa complexa: IA externa planeja → delega micro-tarefas ao workspace_agent → Qwen executa → IA valida → avança.
- [ ] **Implementar memória de tarefa em tempo real (`working_memory`)** · Persistência do estado de execução step-by-step durante tarefas longas.

### 🦅 FASE 3 — Arquitetura do Enxame (consult_expert_ia)
- [ ] **Criar `cloud_bridge.js`** · Script que recebe um prompt estruturado e faz chamada HTTP para a IA externa configurada.
- [ ] **Adicionar ferramenta `consult_expert_ia` no `tool_registry.json` do Qwen**
- [ ] **Implementar lógica de retry no agente local** · Máximo 2 tentativas locais antes de delegar via `consult_expert_ia`.
- [ ] **Implementar gerente de custos / regras de delegação** · Configurável em `agent_rules.json`.
- [ ] **Implementar execução silenciosa nos bastidores**

### 🧠 FASE 4 — Melhorias de memória
- [ ] **Hierarquia de memória: Curto Prazo (Working Memory)** · Formalizar estrutura e limites.
- [ ] **Hierarquia de memória: Médio Prazo (RAG)** · Memória vetorial filtrável por data e relevância semântica.
- [ ] **Hierarquia de memória: Longo Prazo (Cérebro)** · Definir protocolo de promoção RAG → Cérebro.
- [ ] **Embeddings vetoriais via `/v1/embeddings`** · Implementar busca semântica no RAG.
- [ ] **Filtro de data no RAG** · Decaimento temporal configurável.

### 📱 FASE 5 — Milestone 4: App React Native (com nova arquitetura)
> Só iniciar após FASE 1 e FASE 2 validadas.
- [ ] **Inicializar projeto React Native via DevTools.**
- [ ] **Desenvolver estrutura básica do app** · Componentes, navegação.
- [ ] **Implementar interface de chat conversacional.**
- [ ] **Integrar comunicação com llama-server local** · Via HTTP, porta do llama-server.
- [ ] **Implementar ativação de ferramentas via linguagem natural no App.**
- [ ] **Integrar com API REST interna** · Porta 4000, autenticação Bearer Token.
- [ ] **Backup, banco de dados local e testes.**

---

## 🔨 Em Progresso
- [ ] **Reiniciar `ollama_agent.js` e validar personalização do Chronos Local** · Saúde + identidade no prompt do sistema.
- [ ] **Validar acesso de Claude ao `workspace_agent`** · Iniciar `workspace_agent_server.js` no Termux e testar chamada HTTP da próxima sessão.

---

## ✅ Concluído
- [x] **FASE 1: workspace_agent_server.js implementado** · v1.0.0, 9 rotas, porta 3333, bootstrap integrado, documentado. (Claude, 30/05/2026)
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
