# Plano Técnico — Orquestrador Multi-Agente
**Data:** 2026-05-28
**Status:** Planejamento Futuro

---

> # ⚠️ AVISO IMPORTANTE
> ## IMPLEMENTAÇÃO PREMIUM — NÃO IMPLEMENTAR AGORA
> Este plano requer que o sistema base esteja 100% estabilizado, com Git configurado, backup ativo e pelo menos 2 projetos reais rodando no Workspace. É uma evolução avançada da arquitetura atual, não um próximo passo imediato.
> **Pré-requisito obrigatório:** Implementar primeiro o Modelo 1 (MCP Cérebro + MCP Projetos) e validar em produção por pelo menos 30 dias.

---

## Visão Geral

Um Claude Orquestrador central recebe objetivos do usuário e delega subtarefas para sub-agentes especializados. Cada agente é uma chamada independente à API da Anthropic com system prompt, contexto e ferramentas próprias.

```
Usuário (Telegram ou Claude Desktop)
  └── Orquestrador (Node.js no Termux)
        ├── Agente Analista  → lê Cérebro, gera briefings e análises
        ├── Agente Dev       → escreve código, roda testes, faz build
        └── Agente Memória   → consolida RAG, atualiza decisoes_tecnicas.md
```

---

## Componentes a Construir

### 1. Orquestrador (`Scripts/orquestrador/orchestrator.js`)
- Recebe o objetivo do usuário em linguagem natural
- Chama a API da Anthropic com um system prompt de "gerente"
- Quebra o objetivo em subtarefas e identifica qual agente deve executar cada uma
- Coleta os resultados e sintetiza a resposta final
- Registra o histórico da orquestração em `Logs/orchestrator.log`

### 2. Agente Analista (`Scripts/orquestrador/agentes/analista.js`)
**Responsabilidade:** Inteligência e contexto
- System prompt focado em análise, síntese e planejamento
- Acesso de leitura ao Cérebro completo (Kanban, Diário, Memoria-RAG, Preferências)
- Ferramentas: `read_file`, `list_dir`, `search_files`
- Saída: briefings estruturados, análises de viabilidade, planos de ação

### 3. Agente Dev (`Scripts/orquestrador/agentes/dev.js`)
**Responsabilidade:** Execução técnica
- System prompt focado em código limpo, segurança e boas práticas
- Acesso ao filesystem de `Projetos/` e `Scripts/`
- Ferramentas: `create_file`, `run_command`, `move_file`
- Saída: código gerado, resultados de testes, logs de build

### 4. Agente Memória (`Scripts/orquestrador/agentes/memoria.js`)
**Responsabilidade:** Consolidação e aprendizado
- System prompt focado em documentação e persistência de contexto
- Acesso de escrita em `02_Memoria/` e `Memoria-RAG/`
- Ferramentas: `create_file`, `append_file`
- Saída: resumos de sessão, decisões técnicas atualizadas, entradas RAG

---

## Fluxo de Execução

```
1. Usuário: /projeto "criar um app de notas simples"
2. Chronos (bot.js) → chama orchestrator.js
3. Orquestrador → API Anthropic:
   "Quebre esta tarefa em subtarefas e classifique: analista/dev/memoria"
4. Retorno JSON:
   [
     { "agente": "analista", "tarefa": "ler preferências e roadmap" },
     { "agente": "dev",      "tarefa": "criar estrutura de arquivos do app" },
     { "agente": "memoria",  "tarefa": "registrar decisão técnica no Cérebro" }
   ]
5. Orquestrador executa cada agente em sequência (ou paralelo)
6. Resultados consolidados → resposta final para o usuário
```

---

## Stack Técnica

| Componente | Tecnologia |
|---|---|
| Orquestrador | Node.js + API Anthropic |
| Comunicação entre agentes | Promises / async-await |
| Persistência de estado | JSON em `Logs/orchestrator_state.json` |
| Interface do usuário | Telegram (`/projeto`, `/agente`) |
| Modelo dos agentes | claude-haiku (rápido e barato para sub-tarefas) |
| Modelo do orquestrador | claude-sonnet (raciocínio mais profundo) |

---

## Estrutura de Pastas

```
Scripts/
└── orquestrador/
    ├── orchestrator.js       ← núcleo do sistema
    ├── agentes/
    │   ├── analista.js
    │   ├── dev.js
    │   └── memoria.js
    ├── prompts/
    │   ├── system_orquestrador.md
    │   ├── system_analista.md
    │   ├── system_dev.md
    │   └── system_memoria.md
    └── package.json
```

---

## Pré-requisitos Antes de Implementar

- [ ] Git configurado e backup ativo
- [ ] Modelo 1 (MCP Cérebro + MCP Projetos) validado em produção
- [ ] ANTHROPIC_API_KEY ativa no `.env`
- [ ] Pelo menos 2 projetos reais no Workspace como base de teste
- [ ] `Logs/` com auditoria funcionando para rastrear chamadas dos agentes

---

## Custo Estimado de API

Cada execução do orquestrador consome ~3-5 chamadas à API Anthropic (1 orquestrador + N agentes). Com claude-haiku para agentes e claude-sonnet para o orquestrador, o custo por tarefa complexa fica em torno de **$0.01 a $0.05 USD** dependendo do volume de contexto.

---

*Plano gerado pelo Agente Cognitivo via Claude Desktop — 28/05/2026.*
*Não implementar antes de validar o Modelo 1 em produção.*
