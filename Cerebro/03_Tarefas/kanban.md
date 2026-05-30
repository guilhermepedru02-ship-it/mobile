# Kanban — Tarefas do Workspace

## 📋 Backlog

- [ ] Pós-estabilidade: configurar sincronização com repositório remoto privado (`https://github.com/guilhermepedru02-ship-it/mobile`) quando o sistema autônomo mobile estiver estabilizado
- [ ] Verificar se o Git faz o commit da pasta Workspace inteira ou de arquivos específicos de acordo com a escolha do Usuário

### 🧠 Milestone 0: Arquitetura da IA Local Soberana
- [x] Elaborar documento de arquitetura completo (`01_Planejamento/Arquitetura_IA_Local_Soberana.md`)

### ⚙️ Milestone 1: Configuração e Validação do Ollama no Termux
- [x] Pesquisar binário ARM64 compatível com Android/Termux
- [x] Executar a instalação do Ollama via `pkg install ollama` (repositório oficial Termux)
- [x] Baixar modelo `llama3.2:1b` (1.3GB) — único viável para 3.7GB RAM física
- [x] Validar inferência via API HTTP — resposta confirmada, ~0.5 tok/s, cold start ~6.6s
- [x] Registrar decisão técnica em `Cerebro/02_Memoria/decisoes_tecnicas.md`
- [x] Documentar passo a passo de ativação e ciclo de vida da RAM na Memoria-RAG
- [ ] 🔒 **Pós-Milestone 2:** Testar `llama3.2:3b` e comparar qualidade de raciocínio vs. velocidade (~0.2 tok/s, ~2GB RAM)

### 🔧 Milestone 2: Pipeline da IA Local (Dispatch + RAG + Working Memory)
- [ ] Criar `Scripts/core/dispatch.js` — classificador de intenção
- [ ] Criar `Scripts/core/tool_registry.json` — catálogo de ferramentas
- [ ] Criar `Scripts/core/working_memory.js` — memória de execução em tempo real
- [ ] Criar `Scripts/core/context_builder.js` — injeção de contexto para o modelo
- [ ] Criar `Scripts/core/ollama_agent.js` — ponte Ollama ↔ MCP Executor
- [ ] Mapear todos os scripts existentes no catálogo de ferramentas

### 📱 Milestone 3: Integração e Interface
- [ ] Expor agente local via API REST porta 4001
- [ ] Adicionar comando `/local` ao Bot Telegram (Chronos)
- [ ] Implementar fallback automático Ollama → Claude via `/ia`

### 📱 Milestone 4: Desenvolvimento do App React Native (Stress Test)
- [ ] Inicializar projeto React Native via DevTools (`project_init`)
- [ ] Desenvolver estrutura básica do app (componentes, navegação)
- [ ] Implementar interface de chat conversacional
- [ ] Integrar comunicação com Ollama local (via HTTP)
- [ ] Implementar comandos do Chronos (`/backup`, `/status`, `/tarefa`, `/noticias`, `/ia`, `/local`)
- [ ] Integrar com API REST interna (porta 4000) para exibir Kanban, Diário e Status
- [ ] Implementar funcionalidade de backup no próprio chat
- [ ] Adicionar banco de dados local para persistência
- [ ] Realizar testes automatizados e depuração contínua

## 🔨 Em Progresso
*(nenhuma tarefa em andamento)*

## ✅ Concluído
- [x] Instalar Termux e dependências base
- [x] Criar estrutura de diretórios do Workspace
- [x] Desenvolver executor.js com camada de segurança
- [x] Implementar MCP Server (mcp_server.js)
- [x] Testar conexão IA → MCP → Celular com sucesso
- [x] Adicionar operações expandidas ao executor (delete, move, file_info, search)
- [x] Implementar MCP Gatekeeper (Zero Trust)
- [x] Criar arquivos Bootloader (.cursorrules, .clinerules, claude.md)
- [x] Registrar MCP como servidor nativo no Antigravity IDE
- [x] Teste O Analista Autônomo (segurança, I/O, execução)
- [x] Teste Tech Scraper (acesso à internet, geração de nota Obsidian)
- [x] Teste Leitura Massiva e Resumo de Diário
- [x] Consolidar pastas duplicadas do Cérebro
- [x] Reescrever system_prompt.md com protocolo operacional completo
- [x] Definir fluxo de uso do Obsidian (quem escreve onde)
- [x] Configurar workflows operacionais do Obsidian
- [x] Refatorar mcp_server.js v2.0 (multi-conexão para Claude Desktop)
- [x] Refatorar tech_scraper.py para notícias PT/BR (Tecnoblog + Olhar Digital)
- [x] Testar conexão Claude Desktop → MCP → Celular
- [x] Criar API REST (porta 4000) com autenticação Bearer Token
- [x] Criar auth_middleware.js (segurança compartilhada)
- [x] Atualizar mcp_server.js para v2.1 com suporte a NGROK_MODE
- [x] Instalar e configurar túnel Serveo via SSH (substituto do Ngrok)
- [x] Criar script start_tunnel.sh com modos mcp/api/both
- [x] Implementar Chronos v2 (Comandos /tarefa e /ia, otimização de status e split 4000 chars)
- [x] Configurar backup automático do Cerebro (via Telegram)
- [x] Checar funcionamento do túnel Serveo para conexões de IAs web externas (Homologado com Manus)
- [x] Implementar Busca Vetorial Local (RAG Soberano via MiniSearch) com comandos /indexar e /buscar no Telegram
- [x] Implementar Agente MCP de Projetos / DevTools v2.2 (Git, NPM, Python)
- [x] Git local no Workspace para versionamento sem dependência de repositório remoto
- [x] Elaborar Arquitetura da IA Local Soberana (`01_Planejamento/Arquitetura_IA_Local_Soberana.md`)
- [x] **Milestone 1 COMPLETO — Ollama 0.24.0 instalado, llama3.2:1b validado, métricas e guia de ativação documentados**
