# Guia Definitivo de Ativação de Serviços
*Referência viva do Workspace. Deve ser atualizada a cada novo serviço incorporado ao sistema.*
*Última atualização: 2026-05-30 — workspace_agent_server v1.0.0 adicionado (FASE 1 concluída)*

---

## Visão Geral do Stack

| # | Serviço | Porta | Protocolo | Papel no Sistema |
|---|---|---|---|---|
| 1 | llama-server (Qwen 0.5B) | 11434 | HTTP/JSON | Motor de inferência local — DEVE subir primeiro |
| 2 | **workspace_agent_server** | **3333** | **HTTP/JSON** | **MCP universal: filesystem + shell para TODAS as IAs** |
| 3 | Agente Local (ollama_agent) | 4001 | HTTP/JSON | Pipeline IA offline (Chronos Local) |
| 4 | MCP Server | 3001 | SSE/MCP | Núcleo de conexão de IAs externas |
| 5 | API REST | 4000 | HTTP/JSON | Endpoints de dados (opcional) |
| — | Bot Telegram (Chronos v4) | — | Telegram API | Interface remota |
| — | Túnel Serveo | SSH | HTTPS | Acesso externo (opcional) |

---

## ⚡ Atalho Rápido — Um Comando para Tudo

```bash
ws             # Sobe todos os serviços na ordem certa (idempotente)
ws-status      # Painel de saúde de todos os serviços (inclui porta 3333)
ws-restart     # Encerra tudo e reinicia do zero
ws-logs        # Tail ao vivo do llama-server
ws-agent       # Tail ao vivo do agente local
ws-bot         # Tail ao vivo do bot Telegram
```

> Os aliases carregam automaticamente via `.bashrc` em qualquer sessão Termux.

---

## 1. llama-server — Motor de Inferência Local
⚠️ **DEVE iniciar ANTES de qualquer outro serviço que dependa do Qwen.**

**Modelo:** `Models/qwen2.5-0.5b-instruct-q4_k_m.gguf` (469MB)
**RAM:** ~466MB | **Velocidade:** ~12 tok/s | **Contexto:** 1024 tokens

```bash
# Via script (recomendado):
bash /storage/emulated/0/Workspace/Scripts/core/start_llama_server.sh

# Manual com nohup:
nohup llama-server \
  --model /storage/emulated/0/Workspace/Models/qwen2.5-0.5b-instruct-q4_k_m.gguf \
  --ctx-size 1024 --port 11434 --host 127.0.0.1 \
  --threads 4 --batch-size 64 --no-mmap \
  > /storage/emulated/0/Workspace/Logs/llama_server.log 2>&1 &

# Validar:
curl http://localhost:11434/health
# Esperado: {"status":"ok"}
```

> ⚠️ O Android pode matar o llama-server quando a sessão Termux perde foco.
> Sempre verificar com `curl http://127.0.0.1:11434/health` antes de usar `/local` no Telegram.

---

## 2. workspace_agent_server — MCP Universal ⭐ NOVO
**Função:** Expõe o filesystem e shell do workspace como API HTTP para qualquer IA externa.
**Porta:** 3333 | **Script:** `Scripts/core/workspace_agent_server.js`
**Log:** `Logs/workspace_agent.log`

```bash
# Via bootstrap (recomendado — já integrado ao ws/ws-restart):
ws

# Manual:
cd /storage/emulated/0/Workspace/Scripts/core
nohup node workspace_agent_server.js \
  > /storage/emulated/0/Workspace/Logs/workspace_agent.log 2>&1 &

# Validar:
curl http://127.0.0.1:3333/health
# Esperado: {"ok":true,"service":"workspace_agent_server","version":"1.0.0",...}

# Ver todas as rotas disponíveis:
curl http://127.0.0.1:3333/capabilities
```

**Rotas disponíveis:**
| Rota | Função |
|---|---|
| `POST /read_file` | Lê conteúdo de arquivo |
| `POST /write_file` | Cria/sobrescreve arquivo |
| `POST /append_file` | Acrescenta ao final de arquivo |
| `POST /delete_file` | Remove arquivo (não pastas) |
| `POST /move_file` | Move ou renomeia |
| `POST /list_dir` | Lista diretório |
| `POST /run_script` | Executa script existente (.sh/.py/.js/.mjs) |
| `POST /shell_exec` | Comando shell arbitrário com sandbox |
| `POST /apply_patch` | Aplica diff unificado em arquivo |

> 📄 Protocolo completo: `documentação/workspace_agent_protocol.md`

---

## 3. Agente Local — Chronos Local (ollama_agent)
Pipeline: Dispatch → Tool Registry → Context Builder → llama-server → Executor.
**Pré-requisito:** llama-server rodando.

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

## 4. MCP Server — Núcleo de IAs Externas
Conecta Claude Desktop, Antigravity, Manus e outras IAs ao workspace.

```bash
cd /storage/emulated/0/Workspace/Scripts/core
node mcp_server.js
```

> Ver `Cerebro/Memoria-RAG/Guia_Conexao_IAs_Web.md` para configuração de autenticação (USB vs Serveo).

---

## 5. API REST — Endpoints de Dados (Opcional)
```bash
cd /storage/emulated/0/Workspace/Scripts/core
node api_rest.js
```

---

## 6. Bot Telegram — Chronos v4
```bash
cd /storage/emulated/0/Workspace/Projetos/telegram_bot
nohup node bot.js > /storage/emulated/0/Workspace/Logs/bot.log 2>&1 &
```

**Diagnóstico se `/local` não responde:**
```bash
curl http://127.0.0.1:11434/health  # llama-server vivo?
curl http://127.0.0.1:4001/         # agente vivo?
# Se 11434 morto → reiniciar llama-server (item 1)
# Se 4001 morto  → reiniciar agente (item 3)
```

---

## 7. Túnel de Exposição — Serveo (Acesso Externo Opcional)
```bash
bash Scripts/ngrok/start_tunnel.sh mcp    # só MCP
bash Scripts/ngrok/start_tunnel.sh api    # só API REST
bash Scripts/ngrok/start_tunnel.sh both   # ambos
```

---

## Sessões Manuais no Termux (sem usar `ws`)

Deslize da **borda esquerda** → **"New session"**.

| Sessão | Serviço | Obrigatório? |
|---|---|---|
| 1 | `start_llama_server.sh` | Sim (IA local) |
| 2 | `node workspace_agent_server.js` | Sim (MCP universal) |
| 3 | `node ollama_agent.js` | Sim (IA local) |
| 4 | `node mcp_server.js` | Sim (IAs externas) |
| 5 | `node bot.js` | Sim (Telegram) |
| 6 | `node api_rest.js` | Opcional |
| 7 | `start_tunnel.sh` | Opcional |

> **Mínimo para IA local offline:** sessões 1, 2, 3 e 4.

---

## Checklist de Saúde do Sistema
```bash
curl -s http://127.0.0.1:11434/health  # llama-server
curl -s http://127.0.0.1:3333/health   # workspace_agent ⭐
curl -s http://127.0.0.1:4001/         # Agente Local
curl -s http://127.0.0.1:3001/health   # MCP Server
curl -s http://127.0.0.1:4000/health   # API REST
free -h                                 # RAM
```

Ou em um comando só:
```bash
ws-status
```

---

## Instruções para Manutenção deste Guia
> Atualizar sempre que: novo serviço adicionado, porta alterada, script renomeado, milestone concluído.
> A data no cabeçalho deve refletir a última modificação real.
