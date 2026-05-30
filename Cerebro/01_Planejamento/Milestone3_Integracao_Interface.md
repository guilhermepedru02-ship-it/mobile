# Plano: Milestone 3 — Integração do Agente Local ao Chronos
**Data:** 2026-05-29
**Status:** Em Progresso
**Elaborado por:** Agente Claude (via MCP)

---

## Objetivo
Integrar o Agente Local (porta 4001) ao Bot Telegram Chronos, adicionando o comando `/local` com fallback automático para o Claude caso o Ollama esteja offline. Atualizar `/status` e `/start` para refletir o novo estado do sistema.

---

## Diagnóstico do Bot Atual

| Item | Estado |
|---|---|
| Runtime | CommonJS (`require`) |
| Versão atual | Chronos v3 |
| Comandos existentes | /start, /tarefas, /tarefa, /nota, /noticias, /ia, /indexar, /buscar, /status, /backup |
| `/status` verifica | Portas 3001 e 4000 |
| Dependências externas | `node-telegram-bot-api`, `dotenv` |
| Módulo HTTP | `https` (já importado para Claude) |

---

## Alterações Planejadas no `bot.js`

### 1. Import
- Adicionar `const http = require('http');` (nativo Node — zero dependência nova)

### 2. Função `callLocalAgent(prompt)`
- POST para `http://127.0.0.1:4001/agent` com `{"prompt": "..."}`
- Timeout: 58s (margem abaixo do limite do ollama_agent.js)
- Retorna o JSON da resposta ou lanca erro se o servidor não responder

### 3. Comando `/local [prompt]` — Fluxo com Fallback
```
[/local prompt]
    ↓
 callLocalAgent(prompt)
    ├─ sucesso → exibe resposta + ferramenta usada (se houver)
    ├─ result.fallback = true → avisa + chama askClaude()
    └─ erro/timeout → avisa + chama askClaude()
                              ├─ Claude responde → exibe com tag (fallback)
                              └─ Claude falha → "todos os canais indisponíveis"
```

### 4. Atualização do `/status`
- Adicionar verificação das portas 4001 (Agente Local) e 11434 (Ollama)
- Exibir status de todos os 4 serviços

### 5. Atualização do `/start`
- Adicionar `/local [prompt]` ao menu
- Atualizar versão para Chronos v4

---

## Riscos e Mitigações

| Risco | Mitigação |
|---|---|
| Ollama offline no momento do /local | Fallback automático para Claude com aviso ao usuário |
| Agente responde lento (cold start ~6.6s) | Mensagem de feedback imediata: "Consultando IA local..." |
| Resposta longa do agente | Split em 4000 chars (mesmo padrão do /ia) |
| Markdown inválido na resposta do Ollama | `.catch()` no sendMessage, fallback para texto puro |

---

## Resultado Esperado
- `bot.js` atualizado para Chronos v4
- `/local` funcional com fallback inteligente
- `/status` mostrando todos os 6 serviços do stack
- Kanban e Memoria-RAG atualizados
