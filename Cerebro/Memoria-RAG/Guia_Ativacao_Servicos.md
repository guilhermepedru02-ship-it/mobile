# Guia Definitivo de Ativação de Serviços
*Referência viva do Workspace. Deve ser atualizada a cada novo serviço incorporado ao sistema.*
*Última atualização: 2026-05-30 — Migração LLM: Ollama → llama-server + Qwen 0.5B Q4*

---

## Visão Geral do Stack

| Serviço | Porta | Protocolo | Status |
|---|---|---|é---|
| MCP Server | 3001 | SSE/MCP | Núcleo de IA externa |
| API REST | 4000 | HTTP/JSON | Endpoints de dados |
| Agente Local | 4001 | HTTP/JSON | IA offline |
| llama-server (Qwen 0.5B) | 11434 | HTTP/JSON | Motor de inferência |
| Bot Telegram (Chronos v4) | — | Telegram API | Interface remota |
| Túnal Serveo | SSH | HTTPS | Acesso externo (opcional) |

---

## 1. MCP Server — Núcleo de IA Externa
Conecta o celular a IAs externas (Claude) via protocolo MCP.
**Diretório:** `Workspace/Scripts/core`
```bash
cd /storage/emulated/0/Workspace/Scripts/core
node mcp_server.js
```
> Manter rodando em sessão dedicada do Termux.

---

## 2. API REST — Endpoints de Dados
Exposta na porta 4000 com autenticação Bearer Token.
```bash
cd /storage/emulated/0/Workspace/Scripts/core
node api_rest.js
```

---

## 3. llama-server — Motor de Inferência Local ⚠️ DEVE iniciar ANTES do Agente Local
Substitui o Ollama. Roda o modelo Qwen 2.5 0.5B Q4_K_M na porta 11434.
**Modelo:** `/storage/emulated/0/Workspace/Models/qwen2.5-0.5b-instruct-q4_k_m.gguf` (469MB)
**RAM consumida:** ~466MB | **Velocidade:** ~12 tok/s | **ctx:** 1024 tokens

```bash
bash /storage/emulated/0/Workspace/Scripts/core/start_llama_server.sh

# Ou manual:
nohup llama-server \
  --model /storage/emulated/0/Workspace/Models/qwen2.5-0.5b-instruct-q4_k_m.gguf \
  --ctx-size 1024 --port 11434 --host 127.0.0.1 \
  --threads 4 --batch-size 64 --no-mmap \
  > /storage/emulated/0/Workspace/Logs/llama_server.log 2>&1 &

# Validar:
curl http://localhost:11434/health
# Resposta esperada: {"status":"ok"}
```

> **⚠️ Atenção:** O Android pode matar o llama-server quando a sessão Termux perde foco.
> Sempre verificar com `curl http://127.0.0.1:11434/health` antes de usar o bot `/local`.
> Se morto: executar o comando acima novamente.

---

## 4. Agente Local — Orquestrador da IA Offline
Pipeline: Dispatch → Tool Registry → Context Builder → llama-server → Executor.
Exposto na porta 4001 (loopback). Faz auto-desbloqueio do Gatekeeper no startup.
**Pré-requisito:** llama-server rodando (item 3).

```bash
cd /storage/emulated/0/Workspace/Scripts/core
nohup node ollama_agent.js \
  > /storage/emulated/0/Workspace/Logs/agent.log 2>&1 &

# Validar:
curl http://localhost:4001
# Esperado: {"status":"Agente Local Online","model":"qwen2.5-0.5b",...}

# Teste de inferência:
curl -X POST http://localhost:4001/agent \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"quais sao minhas tarefas pendentes?"}'
```

---

## 5. Bot Telegram — Chronos v4 (Interface Remota)
Interface remota via Telegram. Comandos: `/local`, `/ia`, `/status`, `/tarefas`, `/noticias`, `/buscar`, `/indexar`.
```bash
cd /storage/emulated/0/Workspace/Projetos/telegram_bot
nohup node bot.js > /storage/emulated/0/Workspace/Logs/bot.log 2>&1 &
```

**Diagnóstico rápido se `/local` não responde:**
```bash
curl http://127.0.0.1:11434/health  # llama-server vivo?
curl http://127.0.0.1:4001/         # agente vivo?
# Se 11434 morto → reiniciar llama-server (item 3)
# Se 4001 morto  → reiniciar agente (item 4)
```

---

## 6. Túnal de Exposição — Serveo (Acesso Externo Opcional)
```bash
cd /storage/emulated/0/Workspace
bash Scripts/ngrok/start_tunnel.sh mcp    # só MCP
bash Scripts/ngrok/start_tunnel.sh api    # só API REST
bash Scripts/ngrok/start_tunnel.sh both   # ambos
```

---

## Sessões Necessárias no Termux

Deslize da **borda esquerda** → **"New session"**.

| Sessão | Serviço | Obrigatório? |
|---|---|---|
| 1 | `node mcp_server.js` | Sim (IAs externas) |
| 2 | `node bot.js` | Sim (Telegram) |
| 3 | `start_llama_server.sh` | Sim (IA local) |
| 4 | `node ollama_agent.js` | Sim (IA local) |
| 5 | `node api_rest.js` | Opcional |
| 6 | `start_tunnel.sh` | Opcional |

> **Mínimo para IA local offline:** sessões 1, 2, 3 e 4.

---

## Checklist de Saúde do Sistema
```bash
curl -s http://127.0.0.1:3001/health   # MCP Server
curl -s http://127.0.0.1:4000/health   # API REST
curl -s http://127.0.0.1:4001/         # Agente Local
curl -s http://127.0.0.1:11434/health  # llama-server
free -h                                 # RAM
```

---

## Instruções para Manutenção deste Guia
> Atualizar sempre que: novo serviço adicionado, porta alterada, script renomeado, milestone concluído.
> A data no cabeçalho deve refletir a última modificação real.

---

## ⚡ Atalho Rápido — Comandos do Dia a Dia
*Adicionado em 2026-05-30 — Bootstrap + aliases instalados*

```bash
ws             # Sobe todos os serviços na ordem certa (idempotente)
ws-status      # Painel de saúde de todos os serviços
ws-restart     # Encerra tudo e reinicia do zero
ws-logs        # Tail ao vivo do llama-server
ws-agent       # Tail ao vivo do agente local
ws-bot         # Tail ao vivo do bot Telegram
```

> Esses aliases ficam disponíveis em qualquer sessão Termux após `source ~/.bashrc`.
> Em sessões novas: os aliases carregam automaticamente via `.bashrc`.
