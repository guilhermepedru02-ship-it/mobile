# Kanban do Workspace Mobile

> Atualizado em 31/05/2026 · Leitura massiva via Claude MCP · Estado real do sistema após sessão de implementação 30-31/05.

---

## 🎯 Objetivos Atuais
- Ativar `ANTHROPIC_API_KEY` no `.env` para ligar o cloud_bridge (FASE 3)
- Validar Antigravity e Manus.IA no workspace_agent (porta 3333)
- Testar ciclo completo: local fail → cloud fallback
- Evoluir memória para embeddings vetoriais reais (FASE 4)
- Iniciar Milestone 4: App React Native (FASE 5)

---

## 📋 Backlog

### 🧠 FASE 4 — Melhorias de memória
- [ ] **Embeddings vetoriais via `/v1/embeddings`** · Busca semântica real no RAG usando endpoint nativo do llama-server. Substituir MiniSearch (keyword) por vetores. Custo: ~50MB de armazenamento. Impacto alto.
- [ ] **Hierarquia formal de memória** · Formalizar promoção entre camadas: working_memory (sessão) → Memoria-RAG (7 dias) → Cerebro/02_Memoria (longo prazo). Criar `Cerebro/05_Conhecimento/` para documentação permanente.
- [ ] **Filtro de data e decaimento temporal no RAG** · Memórias recentes com peso maior. Decaimento configurável.
- [ ] **Limpeza do Memoria-RAG** · 100+ arquivos `wm_*.json` fragmentados de sessões anteriores. Criar script de consolidação diária que agrega JSONs em um resumo único por dia.

### 📱 FASE 5 — Milestone 4: App React Native
> Iniciar após validação end-to-end do ciclo supervisor-auxiliar em produção.
- [ ] **Inicializar projeto React Native via DevTools.**
- [ ] **Desenvolver estrutura básica** · Componentes, navegação.
- [ ] **Interface de chat conversacional.**
- [ ] **Integrar com llama-server local** · HTTP porta 11434.
- [ ] **Ativação de ferramentas por linguagem natural no App.**
- [ ] **Integrar com API REST interna** · Porta 4000, Bearer Token.
- [ ] **Backup, banco de dados local e testes.**

---

## 🔨 Em Progresso

- [ ] **Adicionar `ANTHROPIC_API_KEY` ao `.env`** · Único bloqueador do cloud_bridge (FASE 3). Sem isso, a arquitetura do Enxame não dispara o fallback. `Scripts/core/cloud_bridge.js` já implementado e aguarda a chave.
- [ ] **Git push para GitHub** · Commit local `50a7609` pendente de push. Inserir token uma vez para cachear. 17 arquivos, 1048 inserções.
- [ ] **Validar acesso de Antigravity ao workspace_agent** · Endpoint porta 3333 já registrado no `tool_registry.json`. Falta teste end-to-end com Antigravity.
- [ ] **Validar acesso de Manus.IA ao workspace_agent** · Idem Manus.
- [ ] **Testar ciclo local fail → cloud fallback** · Derrubar llama-server, disparar prompt, verificar se cloud_bridge assume. Requer `ANTHROPIC_API_KEY` ativa.

---

## ✅ Concluído

### FASE 0 — Limpeza e base
- [x] **Remover Ollama e dependências residuais** · RAM liberada. (30/05/2026)
- [x] **Validar llama-server com Qwen 0.5B Q4_K_M** · Operacional: porta 11434, ctx 1024, ~12 tok/s, RAM ≤ 1GB. (30/05/2026)
- [x] **Ativar zRAM / swap** · Script `00_zram_setup.sh` criado. Android já possui 2.7GB de swap nativo. Swapfile 512MB criado em `~/.swapfile`. Sem root disponível — swapon bloqueado pelo sistema. Stack estável com swap nativo. (31/05/2026)

### FASE 1 — workspace_agent: servidor MCP universal
- [x] **Criar `workspace_agent_server.js`** · Servidor HTTP na porta 3333. Implementado e testado. (30/05/2026)
- [x] **Implementar rotas de leitura e execução** · `read_file`, `run_script`, `shell_exec`, `apply_patch` — todas operacionais. (30/05/2026)
- [x] **Implementar rotas de filesystem** · `write_file`, `append_file`, `delete_file`, `move_file`, `list_dir` — todas com retorno JSON estruturado. (30/05/2026)
- [x] **Registrar no `tool_registry.json`** · v2.4.0 · Entrada `workspace_agent` com todas as rotas, description explícita e `type: mcp_tool`. Disponível para TODAS as IAs via MCP. (30/05/2026)
- [x] **Adicionar ao bootstrap** · `03_start_services.sh` atualizado: workspace_agent é o `[2/5]` da ordem de inicialização, com `nohup` e health check. (31/05/2026)
- [x] **Validar acesso de Claude ao workspace_agent** · Testado end-to-end: `read_file` do kanban e `shell_exec` de `free -h` — ambos OK. (31/05/2026)
- [x] **Documentar protocolo** · `GET /capabilities` retorna JSON completo de todas as rotas, parâmetros e descrições. (30/05/2026)

### FASE 2 — Qwen 0.5B como executor do workspace_agent
- [x] **Criar `workspace_agent_qwen_executor.js`** · Política dual: payload estruturada → bypass direto (zero RAM extra); string em linguagem natural → Qwen interpreta e converte. (30/05/2026)
- [x] **Definir política de uso do Qwen** · Instruções determinísticas: exec direto sem LLM. Instruções ambíguas: Qwen com temperatura 0.0 e max_tokens 80. (30/05/2026)
- [x] **Implementar `working_memory` em tempo real** · `working_memory.js`: startTask, completeStep, finishTask, arquivamento automático na Memoria-RAG. Integrado ao ollama_agent.js. (30/05/2026)

### FASE 3 — Arquitetura do Enxame
- [x] **Criar `cloud_bridge.js`** · `consultExpertIA()`: seleção de backend por prioridade, controle de custos (20 chamadas/dia, alerta em 80%), log auditado, suporte a Anthropic e OpenAI-compat. (30/05/2026)
- [x] **Adicionar `consult_expert_ia` no tool_registry** · Ferramenta registrada com trigger_keywords e description precisa sobre quando usar. (30/05/2026)
- [x] **Lógica de retry (2×) + gerente de custos** · `agent_rules.json` v1.1.0: max 2 tentativas locais, `always_local` vs `prefer_cloud` vs `auto`, `delegation_rules` configuráveis. (30/05/2026)
- [x] **Integrar fallback no ollama_agent.js** · Pipeline completo: dispatch → tool → retry local → cloud fallback → working_memory. Fonte da resposta rastreada (`local` / `cloud` / `tool_direct`). (31/05/2026)
- [x] **Execução silenciosa ativada** · `silent_execution.enabled: true` no agent_rules.json. Log em `Logs/background_tasks.log`. (30/05/2026)

### Concluídos anteriores
- [x] **Personalização Robusta do Chronos Local** · `context_builder.js` com identidade, saúde real e perfil. `tool_registry.json` v2.1.0+. (30/05/2026)
- [x] **Chunking Semântico** · Fragmentação por seções Markdown (##) no `context_builder.js`. (30/05/2026)
- [x] **Reindexacão do Cérebro** · 308 chunks de 47 arquivos em 0.6s. Cache em `.vector_cache.json`. (31/05/2026)
- [x] **Ciclo end-to-end do Agente Local validado** · Dispatch, tool call, synthesis, working memory — 4 prompts testados com sucesso. (31/05/2026)
- [x] **Análise Massiva do Sistema** · Manus.IA 30/05/2026 + Claude 31/05/2026.
- [x] **Migração LLM** · Ollama → llama-server (Qwen 2.5 0.5B Q4_K_M).
- [x] **Milestones 0, 1, 2 e 3 COMPLETOS.**
- [x] Git Remoto ativado + sincronização com GitHub (commit local pendente de push).
- [x] DevTools v2.2 (Git, NPM, Python).
- [x] API REST (porta 4000) com Bearer Token.
