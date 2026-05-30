# Roadmap de Projetos — Workspace Cognitivo Mobile
*Briefing gerado pela IA em 28/05/2026 — para implementação futura*

---

## 1. 🕵️ Agente Analista Autônomo de Mercado
**Base:** Evoluir o `tech_scraper.py` existente.

**O que construir:**
Script Python que acessa feeds RSS de fontes financeiras e tech PT/BR, cruza com o contexto do Cérebro e gera um briefing diário personalizado enviado pelo Chronos no Telegram.

**Componentes necessários:**
- Novos feeds RSS: InfoMoney, Exame, Startups.com.br, Valor Econômico
- Leitura das preferências do usuário em `02_Memoria/preferencias_usuario.md` para filtrar relevância
- Chamada à API da Anthropic para sumarizar e cruzar com contexto
- Envio do briefing via bot Telegram (já pronto)

**Arquivos envolvidos:**
- `Projetos/tech_scraper.py` → base a evoluir
- `Projetos/telegram_bot/bot.js` → comando `/briefing` a adicionar

**Complexidade:** Média | **Impacto:** Alto

#pendente #agente #scraper #telegram #ia

---

## 2. 📱 App Android Nativo — Painel do Workspace
**Base:** API REST já pronta na porta 4000 com Bearer Token.

**O que construir:**
App em React Native (ou Kotlin) que conecta na API REST via Serveo e exibe um dashboard visual: Kanban, diário do dia, status dos serviços, botão para adicionar nota.

**Endpoints já disponíveis:**
- `GET /api/tarefas` → Kanban
- `GET /api/diario/hoje` → Diário do dia
- `GET /api/status` → Status dos serviços
- `POST /api/diario` → Adicionar nota

**Decisão pendente:** React Native vs Kotlin nativo
- React Native → mais rápido, reutiliza JS
- Kotlin → mais performático, integração nativa Android

**Complexidade:** Alta | **Impacto:** Alto

#pendente #app #android #reactnative #kotlin #dashboard

---

## 3. 🔗 Integração n8n / Zapier → Workspace
**Base:** API REST com Bearer Token acessível via túnel Serveo.

**O que construir:**
Automatizações externas que alimentam o Cérebro automaticamente.

**Exemplos de fluxos:**
- Gmail (email importante) → `POST /api/diario` → nota automática
- GitHub issue atualizada → `POST /api/kanban` → nova tarefa
- Google Calendar (evento do dia) → briefing matinal no Telegram

**O que precisa ser implementado na API:**
- Endpoint `POST /api/kanban` para inserção de tarefas

**Complexidade:** Baixa | **Impacto:** Alto

#pendente #n8n #zapier #automacao #webhook #api

---

## 4. 🧠 Segunda Camada de IA — Agente de Projetos (porta 3002)
**Base:** `mcp_server.js` v2.0 com suporte a multi-conexão.

**O que construir:**
Segundo MCP Server especializado em desenvolvimento técnico. Claude Desktop conecta nos dois simultaneamente.

**Ferramentas dedicadas:**
- `build_apk`, `run_tests`, `check_lint`, `deploy_to_device`, `git_commit`

**Estrutura:**
- Copiar `Scripts/core/` → `Scripts/projetos-agent/`
- Trocar ferramentas do executor
- Adicionar segundo MCP no `claude_desktop_config.json`

**Complexidade:** Média | **Impacto:** Alto

#pendente #mcp #agente #android #devtools

---

## 5. 📊 Dashboard Web do Cérebro
**Base:** Express já rodando na porta 4000.

**O que construir:**
Rota `/dashboard` no `api_rest.js` com página HTML que exibe Kanban visual, diário do dia renderizado, resumos da Memoria-RAG, status dos serviços e formulário de nota rápida. Acessível via Serveo.

**Tecnologia:** HTML + CSS + JS vanilla, sem framework.

**Complexidade:** Baixa | **Impacto:** Médio

#pendente #dashboard #web #express #html

---

## 6. 🔄 Sistema de Backup Automático do Cérebro
**Base:** Python + Git + Bot Telegram já disponíveis.

**Estratégia A — Backup via Telegram:**
Comando `/backup` no bot que compacta `Cerebro/` em `.zip` com timestamp e envia como documento.

**Estratégia B — Git privado:**
`git init` em `Scripts/core/` + push semanal para repositório privado GitHub.
`.gitignore`: `.env`, `Logs/`, `node_modules/`, `04_Diario/`

⚠️ Publicação pública apenas com autorização explícita de Guilherme Moreno.

**Complexidade:** Baixa | **Impacto:** Crítico

#pendente #backup #git #seguranca #critico

---

## 📊 Prioridades Sugeridas

| # | Projeto | Complexidade | Impacto | Prioridade |
|---|---|---|---|---|
| 6 | Backup Automático | Baixa | Crítico | 🔴 Urgente |
| 5 | Dashboard Web | Baixa | Médio | 🟡 Logo |
| 3 | Integração n8n/Zapier | Baixa | Alto | 🟡 Logo |
| 1 | Agente Analista de Mercado | Média | Alto | 🟢 Próxima sprint |
| 4 | Agente MCP de Projetos | Média | Alto | 🟢 Próxima sprint |
| 2 | App Android Nativo | Alta | Alto | 🔵 Médio prazo |

---
*Gerado pelo Agente Cognitivo via Claude Desktop em sessão MCP ativa — 28/05/2026.*
*Para iniciar qualquer projeto, referencie este arquivo em uma nova sessão.*

---

## 7. 🔐 Sincronização com Repositório Git Remoto Privado — Pós-Estabilidade
**Base:** Git local já disponível no Android e capacidade de versionamento local homologada para projetos dentro de `Projetos/`.

**Decisão estratégica:**
A integração com repositório remoto **não será implementada neste momento**. O foco atual permanece em estabilizar completamente o sistema de desenvolvimento autônomo mobile movido por IA, mantendo o versionamento local como mecanismo principal de histórico e controle durante a fase de consolidação.

**Repositório remoto reservado:**
`https://github.com/guilhermepedru02-ship-it/mobile` — atualmente privado.

**Critério de ativação futura:**
A conexão remota será retomada somente depois que a arquitetura mobile autônoma estiver estável, incluindo MCP, DevTools, Chronos, API REST, backup, RAG local e fluxo de desenvolvimento com commits locais funcionando de forma confiável.

| Dimensão | Decisão Atual | Evolução Futura |
|---|---|---|
| Versionamento | Git local no Android | Push/pull com GitHub ou GitLab |
| Segurança | Código permanece no dispositivo | Repositório remoto privado como redundância |
| Dependência externa | Nenhuma para desenvolvimento diário | GitHub/GitLab apenas na fase pós-estabilidade |
| Objetivo | Estabilizar o ecossistema autônomo mobile | Backup remoto, acesso externo e portfólio controlado |

**Complexidade:** Baixa | **Impacto:** Alto | **Momento:** Pós-estabilidade

#futuro #git #github #repositorio-remoto #pos-estabilidade #seguranca #mobile-autonomo

---

## 8. 📱 Desenvolvimento Autônomo da Interface Mobile (Ollama + React Native)
**Base:** Git local configurado, DevTools MCP funcional, API REST interna (porta 4000) e Chronos v2 (bot Telegram) implementados.

**O que construir:**
Um aplicativo Android nativo em React Native que servirá como a interface conversacional principal do Workspace. Este app integrará o Ollama rodando localmente no Termux para soberania de IA, e consolidará todas as funcionalidades do Chronos v2 (comandos como `/backup`, `/status`, `/tarefa`, `/noticias`, `/ia`). O desenvolvimento deste app será um **stress test real** para a capacidade de auto-desenvolvimento do sistema, onde a IA (via MCP e DevTools) será responsável por gerar, testar e iterar sobre o código.

**Componentes chave:**
- Chat conversacional com Ollama local.
- Comandos do Chronos integrados nativamente.
- Funcionalidade de backup no próprio chat.
- Banco de dados local para histórico e estados.
- Consumo da API REST interna para Kanban, Diário e Status.
- Arquitetura preparada para futura acoplagem de MCP + túnel web.

**Stack:** React Native (para o app), Ollama (para IA local).

**Sequência de Milestones:**
1.  **Milestone 1:** Configuração e Validação do Ollama no Termux.
2.  **Milestone 2:** Desenvolvimento do App React Native (Stress Test).

**Complexidade:** Alta | **Impacto:** Crítico | **Momento:** Próxima sprint (após validação do Ollama)

#app #android #reactnative #ollama #ia-local #autonomo #stress-test #interface
