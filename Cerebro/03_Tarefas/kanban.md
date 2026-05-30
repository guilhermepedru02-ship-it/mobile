# Kanban do Workspace Mobile

> Atualizado em 30/05/2026 via sessão Claude · Incorpora especificações do diário: Limitações Qwen 0.5, Mini-Agente Auxiliar Supervisionado, workspace_agent MCP Universal e Arquitetura do Enxame.

---

## 🎯 Objetivos Atuais
- Implementar o `workspace_agent` como ferramenta MCP universal acessível por todas as IAs.
- Configurar Qwen 0.5B Q4 como executor local de micro-tarefas supervisionadas.
- Implementar a Arquitetura do Enxame (`consult_expert_ia`) com gerente de custos.
- Solidificar a hierarquia de memória antes de retomar o Milestone 4.
- Manter soberania de dados e eficiência do sistema Android.

---

## 📋 Backlog

### 🧹 FASE 0 — Limpeza e base
- [ ] **Ativar zRAM no Android** · Configurar swap comprimido para ampliar memória disponível ao llama-server e ao workspace_agent.

### 🔌 FASE 1 — workspace_agent: servidor MCP universal
- [ ] **Criar `workspace_agent_server.js`** · Servidor HTTP local no Termux que expõe as rotas do agente. Porta dedicada (ex: 3333). Deve iniciar junto com o bootstrap do sistema.
- [ ] **Implementar rota `read_file`** · Recebe `{ path }`, retorna conteúdo do arquivo como string. Inclui tratamento de erro para arquivo não encontrado.
- [ ] **Implementar rota `run_script`** · Recebe `{ script_path, args }`, executa via shell e retorna `{ stdout, stderr, exit_code }`.
- [ ] **Implementar rota `shell_exec`** · Recebe `{ command }`, executa comando shell arbitrário com sandbox de segurança, retorna stdout.
- [ ] **Implementar rota `apply_patch`** · Recebe `{ path, diff }`, aplica patch no arquivo indicado.
- [ ] **Implementar rotas de filesystem** · `write_file`, `move_file`, `delete_file`, `list_dir` — todas com retorno de status estruturado.
- [ ] **Registrar `workspace_agent` no `tool_registry.json`** · Entrada com `name`, `description` (explícita sobre limites de uso), `endpoint` e `type: mcp_tool`. Disponível para TODAS as IAs externas via MCP.
- [ ] **Adicionar `workspace_agent_server.js` ao bootstrap** · Garantir inicialização automática com `nohup` / Phantom Process Killer.
- [ ] **Validar acesso de Claude ao `workspace_agent`** · Teste end-to-end: Claude chama `read_file`, recebe conteúdo, avança na tarefa.
- [ ] **Validar acesso de Antigravity ao `workspace_agent`** · Mesmo teste com Antigravity para confirmar universalidade.
- [ ] **Validar acesso de Manus.IA ao `workspace_agent`** · Idem com Manus.
- [ ] **Documentar protocolo de payload e resposta** · Criar `documentação/workspace_agent_protocol.md` com exemplos de cada rota.

### 🤖 FASE 2 — Qwen 0.5B como executor do workspace_agent
- [ ] **Integrar Qwen 0.5B como motor do `workspace_agent`** · O servidor recebe a instrução JSON, passa para o Qwen formatar/confirmar a ação e executa. Para operações determinísticas simples, o Qwen pode ser bypassado (exec direto).
- [ ] **Definir política de uso do Qwen no agente** · Qwen interpreta instruções ambíguas; para comandos claros (`read_file` + path), execução direta sem LLM para economizar RAM e tempo.
- [ ] **Testar ciclo completo supervisor-auxiliar** · Simular tarefa complexa: IA externa planeja → delega micro-tarefas ao workspace_agent → Qwen executa → IA valida → avança.
- [ ] **Implementar memória de tarefa em tempo real (`working_memory`)** · Persistência do estado de execução step-by-step durante tarefas longas. O agente não perde o fio mesmo que o contexto do LLM seja resetado.

### 🦅 FASE 3 — Arquitetura do Enxame (consult_expert_ia)
- [ ] **Criar `cloud_bridge.js`** · Script que recebe um prompt estruturado e faz chamada HTTP para a IA externa configurada (ANTHROPIC_API_KEY do `.env`). Retorna resposta como string.
- [ ] **Adicionar ferramenta `consult_expert_ia` no `tool_registry.json` do Qwen** · Description: "Use quando a tarefa exigir raciocínio complexo, arquitetura avançada ou quando falhar 2x localmente. Envia contexto estruturado para IA externa e retorna solução."
- [ ] **Implementar lógica de retry no agente local** · Máximo 2 tentativas locais antes de delegar via `consult_expert_ia`. Contador de falhas no `working_memory`.
- [ ] **Implementar gerente de custos / regras de delegação** · Regras configuráveis: organização de arquivos → sempre local; novo algoritmo / debugging complexo → sempre nuvem. Configurável em `agent_rules.json`.
- [ ] **Implementar execução silenciosa nos bastidores** · Log discreto: "Consultando inteligência externa..." sem interromper o fluxo da tarefa para o usuário.

### 🧠 FASE 4 — Melhorias de memória
- [ ] **Hierarquia de memória: Curto Prazo (Working Memory)** · Memória de sessão ativa, resetada por conversa. Já existe parcialmente — formalizar estrutura e limites.
- [ ] **Hierarquia de memória: Médio Prazo (RAG)** · Memória vetorial filtrável por data e relevância semântica. Distinguir claramente do longo prazo.
- [ ] **Hierarquia de memória: Longo Prazo (Cérebro)** · Notas consolidadas do Obsidian. Definir protocolo de promoção: quando algo vai do RAG para o Cérebro.
- [ ] **Embeddings vetoriais via `/v1/embeddings`** · Implementar busca semântica no RAG usando endpoint do llama-server. Substituir busca por keyword onde possível.
- [ ] **Filtro de data no RAG** · Garantir que memórias mais recentes tenham peso maior. Implementar decaimento temporal configurável.

### 📱 FASE 5 — Milestone 4: App React Native (com nova arquitetura)
> Só iniciar após FASE 1 e FASE 2 validadas. O Milestone 4 será executado com o modelo supervisor (IA externa) + auxiliar (workspace_agent) ativo.
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

---

## ✅ Concluído
- [x] **Remover Ollama e todas as dependências residuais** · RAM liberada, lixo eletrônico removido do sistema. (30/05/2026)
- [x] **Validar llama-server com Qwen 0.5B Q4_K_M** · Modelo operacional: contexto 512, temperatura 0.7, GGUF, RAM ≤ 1 GB, sem travar o celular. (30/05/2026)
- [x] **Personalização Robusta do Chronos Local** · `context_builder.js` reescrito com identidade, saúde real do sistema e perfil do usuário. `tool_registry.json` v2.1.0 com `self_health_check`. (Claude, 30/05/2026)
- [x] **Arquitetura do Mini-Agente documentada no diário** · Especificações: workspace_agent universal MCP, supervisor-auxiliar, Enxame, limites do Qwen 0.5B. (Claude, 30/05/2026)
- [x] **Chunking Semântico** · Fragmentação por seções Markdown (##) no `context_builder.js` para RAG coerente.
- [x] **Análise Massiva do Sistema** · Realizada pela IA Manus em 30/05/2026.
- [x] **Alinhamento do Cérebro** · Notas e protocolos atualizados para llama-server (Qwen 2.5).
- [x] **Migração LLM COMPLETA** · Ollama → llama-server (Qwen 2.5).
- [x] **Milestones 0, 1, 2 e 3 COMPLETOS.**
- [x] Ativação do Git Remoto e sincronização com GitHub.
- [x] DevTools v2.2 (Git, NPM, Python).
- [x] API REST (porta 4000) com autenticação Bearer Token.
