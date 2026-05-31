# Guia Definitivo de Ativação de Serviços
*Referência viva do Workspace. Deve ser atualizada a cada novo serviço incorporado ao sistema.*
*Última atualização: 2026-05-31 — zRAM script + FASE 3 cloud_bridge + silent_execution ativado + stack 6/6 validada ao vivo*

---

## Visão Geral do Stack

| # | Serviço | Porta | Protocolo | Papel no Sistema |
|---|---|---|---|---|
| 0 | **zRAM / Swap** | — | Kernel | Ampliar RAM disponível para llama-server (2.7GB swap Android nativo já ativo) |
| 1 | llama-server (Qwen 0.5B) | 11434 | HTTP/JSON | Motor de inferência local — DEVE subir primeiro |
| 2 | workspace_agent_server | 3333 | HTTP/JSON | MCP universal: filesystem + shell para TODAS as IAs |
| 3 | Agente Local (ollama_agent) | 4001 | HTTP/JSON | Pipeline IA offline — Chronos Local (retry 2× + cloud fallback) |
| 4 | MCP Server | 3001 | SSE/MCP | Núcleo de conexão de IAs externas (Claude, Antigravity, Manus) |
| 5 | API REST | 4000 | HTTP/JSON | Endpoints de dados com autenticação Bearer Token |
| — | Bot Telegram (Chronos v4) | — | Telegram API | Interface remota via chat |
| — | cloud_bridge (interno) | — | HTTPS | Fallback para Anthropic API quando llama-server falha 2× |
| — | Túnel Serveo | SSH | HTTPS | Acesso externo para IAs da nuvem (opcional) |

---

## ⚡ Atalho Rápido — Um Comando para Tudo

```bash
ws             # Sobe todos os serviços na ordem certa (idempotente)
ws-status      # Painel de saúde de todos os serviços
ws-restart     # Encerra tudo e reinicia do zero
ws-logs        # Tail ao vivo do llama-server
ws-agent       # Tail ao vivo do agente local
ws-bot         # Tail ao vivo do bot Telegram
```

> Os aliases carregam automaticamente via `.bashrc` em qualquer sessão Termux.

---

## 0. zRAM — Ampliar Memória Disponível

**Status atual:** 2.7GB de Swap já ativo nativamente pelo Android. Suficiente para o stack atual.

**Script criado:** `Scripts/bootstrap/00_zram_setup.sh`
- **Com root:** Configura zRAM 1GB via `/sys/block/zram0` com algoritmo lz4 e ajusta swappiness para 20.
- **Sem root (atual):** Cria swapfile de 512MB em `~/.swapfile`. Swapfile já criado em 30/05/2026.
- **Swappiness:** Não alterável sem root — mantido no padrão Android.

```bash
# Executar setup (diagnóstico + ativação):
bash Scripts/bootstrap/00_zram_setup.sh

# Verificar swap ativo:
free -h   # Linha Swap mostrará o total disponível
```

> 💡 O Android já gerencia zRAM internamente. O script é principalmente útil se você obtiver root no futuro.

---

## 1. llama-server — Motor de Inferência Local
⚠️ **DEVE iniciar ANTES de qualquer outro serviço que dependa do Qwen.**

**Modelo:** `Models/qwen2.5-0.5b-instruct-q4_k_m.gguf` (469MB)
**RAM:** ~466MB | **Velocidade:** ~12 tok/s | **Contexto:** 1024 tokens | **Porta:** 11434

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

## 2. workspace_agent_server — MCP Universal
**Função:** Expõe filesystem e shell do workspace como API HTTP para QUALQUER IA externa.
**Porta:** 3333 | **Script:** `Scripts/core/workspace_agent_server.js`
**Log:** `Logs/workspace_agent.log` | **Validado:** Claude ✅ (Antigravity/Manus.IA pendente — Guilherme fará)

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

# Ver todas as rotas:
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

---

## 3. Agente Local — Chronos Local (ollama_agent v2.0.0)
Pipeline: Dispatch → Tool Registry → Context Builder (MiniSearch RAG) → llama-server → Executor → (fallback cloud_bridge).
**Pré-requisito:** llama-server rodando. | **Porta:** 4001

**Novidades v2.0.0:**
- Retry automático: 2 tentativas locais antes de desistir
- Fallback para cloud_bridge (Anthropic API) quando local falha
- Working Memory integrada: rastreia tarefa atual com startTask/completeStep/finishTask
- silent_execution habilitado: delegações assíncronas em segundo plano

```bash
cd /storage/emulated/0/Workspace/Scripts/core
nohup node ollama_agent.js \
  > /storage/emulated/0/Workspace/Logs/agent.log 2>&1 &

# Validar:
curl http://localhost:4001
# Esperado: {"status":"Agente Local Online","model":"qwen2.5-0.5b","version":"2.0.0",...}

# Teste de inferência:
curl -X POST http://localhost:4001/agent \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"quanto de ram está disponível?"}'

# Status detalhado (inclui working memory):
curl http://localhost:4001/status
```

**Regras de delegação (agent_rules.json v1.1.0):**
- `always_local`: ram_status, disk_usage, git_status, kanban_read, diary_today, llm_status, etc.
- `prefer_cloud`: architecture_decision, complex_debugging, detailed_code_generation, milestone_planning
- `auto (retry→cloud)`: KNOWLEDGE_QUERY, CODE_TASK, CREATIVE_TASK

---

## 4. cloud_bridge — Fallback para IA em Nuvem (FASE 3)
**Função:** Quando o agente local falha 2×, delega automaticamente para Anthropic API.
**Módulo:** `Scripts/core/cloud_bridge.js` (interno — não tem porta própria)
**Config:** `Scripts/core/agent_rules.json` v1.1.0
**Log:** `Logs/cloud_bridge.log` | **Uso:** `Logs/cloud_usage.json`

**Pré-requisito para ativar:**
```bash
# Adicionar ao arquivo .env na raiz do Workspace:
ANTHROPIC_API_KEY=sua_chave_aqui
```

**Controle de custo:**
- Máximo 20 chamadas/dia para a API Anthropic
- Alerta automático ao atingir 80% do limite
- Rastreamento de tokens em `Logs/cloud_usage.json`

```bash
# Verificar uso de hoje:
node -e "import('./Scripts/core/cloud_bridge.js').then(m => console.log(JSON.stringify(m.getUsageSummary(), null, 2)))"

# Testar cloud_bridge manualmente:
node Scripts/core/cloud_bridge.js "qual é o sentido da vida?"
```

---

## 5. MCP Server — Núcleo de IAs Externas
Conecta Claude Desktop, Antigravity, Manus e outras IAs ao workspace.
**Autenticação:** Automática por origem (USB = sem senha, Túnel = token na URL)

```bash
cd /storage/emulated/0/Workspace/Scripts/core
nohup node mcp_server.js \
  > /storage/emulated/0/Workspace/Logs/mcp_server.log 2>&1 &
```

> Ver `Cerebro/Memoria-RAG/Guia_Conexao_IAs_Web.md` para configuração completa de autenticação (USB vs Serveo).

---

## 6. API REST — Endpoints de Dados
**Porta:** 4000 | **Auth:** Bearer Token | **Log:** `Logs/api_rest.log`

```bash
cd /storage/emulated/0/Workspace/Scripts/core
nohup node api_rest.js > /storage/emulated/0/Workspace/Logs/api_rest.log 2>&1 &

# Validar (retorna 401 = servidor online):
curl http://127.0.0.1:4000/health
```

---

## 7. Bot Telegram — Chronos v4
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

## 8. Túnel de Exposição — Serveo (Acesso Externo Opcional)
```bash
bash Scripts/ngrok/start_tunnel.sh mcp    # só MCP
bash Scripts/ngrok/start_tunnel.sh api    # só API REST
bash Scripts/ngrok/start_tunnel.sh both   # ambos
```

---

## Checklist de Saúde Completa
```bash
ws-status
# OU manualmente:
curl -s http://127.0.0.1:11434/health  # llama-server
curl -s http://127.0.0.1:3333/health   # workspace_agent
curl -s http://127.0.0.1:4001/         # Agente Local
curl -s http://127.0.0.1:3001/health   # MCP Server
curl -s http://127.0.0.1:4000/health   # API REST (retorna 401 = ok)
free -h                                 # RAM e Swap
```

---

## Sessões Manuais no Termux (sem usar `ws`)

| Sessão | Serviço                          | Obrigatório?                    |
| ------ | -------------------------------- | ------------------------------- |
| 1      | `start_llama_server.sh`          | Sim (IA local)                  |
| 2      | `node workspace_agent_server.js` | Sim (MCP universal)             |
| 3      | `node ollama_agent.js`           | Sim (Chronos Local)             |
| 4      | `node mcp_server.js`             | Sim (IAs externas)              |
| 5      | `node bot.js`                    | Sim (Telegram)                  |
| 6      | `node api_rest.js`               | Opcional                        |
| 7      | `start_tunnel.sh`                | Opcional (IAs da nuvem sem USB) |

> **Mínimo para IA local offline:** sessões 1, 2, 3 e 4.

---

## Histórico de Atualizações
| Data | Mudança |
|---|---|
| 2026-05-31 | zRAM script (00_zram_setup.sh) + cloud_bridge FASE 3 + silent_execution + stack 6/6 validada ao vivo + reindexação 308 chunks |
| 2026-05-30 | workspace_agent_server v1.0.0 (porta 3333) + bootstrap integrado + ollama_agent v2.0.0 (retry+fallback) + MiniSearch RAG |
| 2026-05-29 | Git remoto + DevTools v2.2 + API REST + llama-server migração |
