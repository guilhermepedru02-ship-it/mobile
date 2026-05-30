# Plano: Arquitetura da IA Local Soberana (Ollama + MCP)
**Data:** 2026-05-29
**Status:** Pendente
**Autor do Briefing:** Guilherme Moreno (Diário 2026-05-29)
**Elaborado por:** Agente Claude (via MCP)

---

## Objetivo

Projetar e implementar uma IA local offline rodando no Android/Termux via Ollama, integrada ao ecossistema MCP já existente. O objetivo não é substituir as IAs externas (Claude, Manus, Antigravity), mas criar um **agente operacional autônomo e soberano** capaz de executar tarefas cotidianas do Workspace sem depender de API key, internet ou custo por token.

A inteligência do sistema não virá apenas do modelo — virá da **arquitetura de governança de dados, ferramentas pré-construídas e memória estruturada** que compensará as limitações cognitivas naturais de modelos pequenos (3B–7B).

---

## Princípio Central

> *A IA local não precisa saber tudo. Ela precisa saber o que acionar, quando acionar e como registrar o que está fazendo.*

Esse princípio guia todas as decisões arquiteturais abaixo.

---

## Etapas

### FASE 1 — Fundação (Ollama no Termux)
- [ ] Pesquisar binário ARM64 compatível com Android/Termux
- [ ] Instalar Ollama via `run_command` no Termux
- [ ] Baixar modelo inicial: `llama3.2:3b` (leve) ou `mistral:7b-instruct-q4_K_M` (mais capaz)
- [ ] Validar inferência básica via `ollama run` no terminal
- [ ] Documentar RAM consumida, velocidade de tokens/seg e temperatura do dispositivo
- [ ] Registrar resultado em `02_Memoria/decisoes_tecnicas.md`

### FASE 2 — Camada de Dispatch (O Cérebro do Sistema)
- [ ] Criar `Scripts/core/dispatch.js` — recebe o prompt do usuário e decide o fluxo
- [ ] Implementar classificador de intenção leve (regex + palavras-chave) para categorizar o pedido:
  - `TOOL_CALL` → acionar script/ferramenta existente
  - `CODE_TASK` → tarefa de engenharia via DevTools
  - `KNOWLEDGE_QUERY` → consultar RAG Soberano
  - `CREATIVE_TASK` → geração livre pelo modelo
  - `MEMORY_WRITE` → registrar algo na Memoria-RAG
- [ ] Integrar com RAG Soberano (MiniSearch já implementado) para enriquecer o contexto antes de chamar o Ollama

### FASE 3 — Catálogo de Ferramentas (O Arsenal da IA)
- [ ] Criar `Scripts/core/tool_registry.json` — catálogo estruturado de todas as ferramentas disponíveis:
  ```json
  {
    "tools": [
      {
        "id": "tech_news",
        "description": "Busca as últimas notícias de tecnologia em PT/BR via RSS",
        "trigger_keywords": ["notícias", "tech", "novidades"],
        "command": "python3 /storage/emulated/0/Workspace/Projetos/tech_scraper/tech_scraper.py",
        "output": "markdown"
      },
      {
        "id": "git_status",
        "description": "Mostra o status atual do repositório Git local",
        "trigger_keywords": ["git", "commit", "repositório", "versionamento"],
        "command": "git -C /storage/emulated/0/Workspace status",
        "output": "text"
      },
      {
        "id": "kanban_read",
        "description": "Lê o Kanban de tarefas atual",
        "trigger_keywords": ["tarefas", "kanban", "pendências", "backlog"],
        "command": "read_file",
        "path": "Cerebro/03_Tarefas/kanban.md",
        "output": "markdown"
      }
    ]
  }
  ```
- [ ] Mapear todos os scripts Python e Shell existentes no Workspace para o catálogo
- [ ] Estabelecer padrão de documentação para novos scripts adicionados ao catálogo

### FASE 4 — Working Memory em Tempo Real
- [ ] Criar `Scripts/core/working_memory.js` — módulo de memória de execução
- [ ] Implementar estrutura de Working Memory por sessão de tarefa:
  ```json
  {
    "task_id": "uuid-gerado",
    "task_description": "O que o usuário pediu",
    "started_at": "ISO timestamp",
    "steps_completed": [
      { "step": 1, "action": "leu o kanban", "result": "ok", "timestamp": "..." }
    ],
    "steps_pending": [
      { "step": 2, "action": "criar arquivo de plano" }
    ],
    "context_variables": {},
    "status": "in_progress"
  }
  ```
- [ ] Salvar working memory em `Cerebro/02_Memoria/working_memory_active.json` durante execução
- [ ] Limpar/arquivar após conclusão da tarefa
- [ ] A IA deve consultar esse arquivo a cada passo de uma tarefa longa antes de agir

### FASE 5 — Integração Ollama + MCP
- [ ] Criar `Scripts/core/ollama_agent.js` — ponte entre o Ollama local e o executor MCP
- [ ] Implementar o fluxo completo de uma chamada ao agente:
  ```
  [Prompt] → [Dispatch] → [RAG Context] → [Tool Registry] → [Ollama] → [Executor MCP] → [Resposta]
  ```
- [ ] Expor o agente local via endpoint REST na porta 4001 (separado da API existente na 4000)
- [ ] Integrar ao Bot Telegram (Chronos) com novo comando `/local` para acionar a IA offline
- [ ] Implementar fallback automático: se o Ollama estiver offline, redirecionar para Claude via `/ia`

### FASE 6 — Injeção de Contexto Inteligente (Prompt Engineering para Modelos Pequenos)
- [ ] Criar `Scripts/core/context_builder.js` — monta o prompt final enviado ao Ollama
- [ ] Definir o System Prompt fixo da IA local (compacto, máximo 500 tokens):
  - Identidade e missão
  - Referência ao catálogo de ferramentas
  - Regras de segurança essenciais
  - Instrução de uso da working memory
- [ ] Implementar seleção dinâmica de contexto via RAG — injetar apenas os 3 fragmentos mais relevantes da Memoria-RAG para cada tarefa
- [ ] Garantir que o prompt total (system + contexto + tarefa) caiba dentro da janela de contexto do modelo (meta: abaixo de 3.000 tokens para modelos 3B–7B)

### FASE 7 — Capacidade de Auto-Expansão (DevTools Integrado)
- [ ] Garantir que o agente local tenha acesso ao DevTools v2.2 (Git, NPM, Python)
- [ ] Implementar habilidade de criar novos scripts e automaticamente registrá-los no `tool_registry.json`
- [ ] Criar template padrão de novo script para que a IA produza ferramentas no formato esperado pelo catálogo
- [ ] Implementar validação de segurança antes de registrar nova ferramenta (blacklist de comandos já existente)

---

## Arquitetura Final — Diagrama de Fluxo

```
╔══════════════════════════════════════════════════════════╗
║              ENTRADA DO USUÁRIO                          ║
║         (Telegram /local  |  App React Native)           ║
╚══════════════════════════╦═══════════════════════════════╝
                           ↓
╔══════════════════════════════════════════════════════════╗
║              DISPATCH.JS (Classificador)                 ║
║  TOOL_CALL | CODE_TASK | KNOWLEDGE_QUERY | CREATIVE_TASK ║
╚══════╦═══════════════╦══════════════════╦════════════════╝
       ↓               ↓                  ↓
  [Tool Registry]  [RAG Soberano]   [Working Memory]
  tool_registry    MiniSearch       working_memory
  .json            (contexto)       _active.json
       ↓               ↓                  ↓
╔══════════════════════════════════════════════════════════╗
║              CONTEXT_BUILDER.JS                          ║
║   System Prompt + Ferramenta + RAG Context + WM State    ║
╚══════════════════════════╦═══════════════════════════════╝
                           ↓
╔══════════════════════════════════════════════════════════╗
║              OLLAMA LOCAL (porta 11434)                  ║
║              llama3.2:3b / mistral:7b-q4                 ║
╚══════════════════════════╦═══════════════════════════════╝
                           ↓
╔══════════════════════════════════════════════════════════╗
║              EXECUTOR MCP / DEVTOOLS                     ║
║   create_file | run_command | git | npm | python3        ║
╚══════════════════════════╦═══════════════════════════════╝
                           ↓
╔══════════════════════════════════════════════════════════╗
║              RESPOSTA + ATUALIZAÇÃO DE MEMÓRIA           ║
║   Working Memory arquivada | Memoria-RAG atualizada      ║
╚══════════════════════════════════════════════════════════╝

                    ↓ se Ollama offline ↓
╔══════════════════════════════════════════════════════════╗
║         FALLBACK — Claude / Manus via MCP+Tunnel         ║
╚══════════════════════════════════════════════════════════╝
```

---

## Stack de Serviços Após Implementação Completa

| Serviço | Porta | Protocolo | Função |
|---|---|---|---|
| MCP Server | 3001 | SSE/MCP | Conexão com IAs externas (Claude, Manus) |
| API REST | 4000 | HTTP/JSON | Endpoints de dados do Workspace |
| Ollama | 11434 | HTTP/JSON | Inferência da IA local offline |
| Agente Local | 4001 | HTTP/JSON | Orquestrador do pipeline IA local |
| Bot Telegram | — | Telegram API | Interface de comando remoto |
| Túnel Serveo | SSH | HTTPS | Acesso externo (fallback) |

---

## Riscos e Mitigações

| Risco | Probabilidade | Mitigação |
|---|---|---|
| Hardware insuficiente para rodar 7B | Alta | Começar com 3B e avaliar; usar quantização Q4 |
| Janela de contexto insuficiente | Média | Context Builder com limite rígido de 3K tokens |
| Ollama incompatível com ARM Android | Média | Testar binário llama.cpp como alternativa |
| IA local tomando decisões erradas | Baixa | Todas as ações destrutivas exigem confirmação |
| Latência alta tornando o sistema lento | Alta | Usar IA local apenas para tarefas não urgentes |

---

## Resultado Esperado

Ao final das 7 fases, o Workspace terá:

1. **Uma IA operacional offline** — sem API key, sem internet, com custo zero
2. **Um catálogo vivo de ferramentas** — que cresce conforme novas automações são criadas
3. **Memória de execução em tempo real** — a IA nunca perde o fio da meada em tarefas longas
4. **Fallback inteligente** — Claude e Manus continuam disponíveis para tarefas complexas
5. **Um sistema verdadeiramente soberano** — onde a inteligência está na arquitetura, não apenas no modelo

---

## Notas Finais

Este documento deve ser revisado após a conclusão de cada fase. Decisões técnicas tomadas durante a implementação devem ser registradas em `02_Memoria/decisoes_tecnicas.md`. Ao concluir cada fase, atualizar o Kanban em `03_Tarefas/kanban.md`.

> *"A sagacidade da coisa está na arquitetura de governança de dados."*
> — Guilherme Moreno, Diário 2026-05-29
