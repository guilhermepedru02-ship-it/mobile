#!/data/data/com.termux/files/usr/bin/bash
# =============================================================
# 03_start_services.sh — Workspace Mobile: Inicialização Completa
# Ordem: llama-server → Workspace Agent → Agente Local → MCP Server → Bot Telegram
# Uso: bash 03_start_services.sh
#      bash 03_start_services.sh --status    (só checa saúde)
#      bash 03_start_services.sh --restart   (mata tudo e reinicia)
# =============================================================

CORE="/storage/emulated/0/Workspace/Scripts/core"
LOGS="/storage/emulated/0/Workspace/Logs"
MODEL="/storage/emulated/0/Workspace/Models/qwen2.5-0.5b-instruct-q4_k_m.gguf"
BOT="/storage/emulated/0/Workspace/Projetos/telegram_bot"

mkdir -p "$LOGS"

# ── Cores para output ──────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()  { echo -e "${GREEN}  [OK]${NC} $1"; }
warn(){ echo -e "${YELLOW}  [!!]${NC} $1"; }
fail(){ echo -e "${RED}  [XX]${NC} $1"; }

# ── Verifica se porta está respondendo ──────────────────────────────
check_port() {
  curl -s --max-time 3 "http://127.0.0.1:$1/$2" > /dev/null 2>&1
  return $?
}

# ── Modo --status ──────────────────────────────────────────────
if [ "$1" = "--status" ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Workspace — Saúde dos Serviços"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  check_port 11434 health && ok "llama-server       (11434)" || fail "llama-server       (11434) — MORTO"
  check_port 3333  health && ok "Workspace Agent    (3333)"  || fail "Workspace Agent    (3333)  — MORTO"
  check_port 4001  ""     && ok "Agente Local       (4001)"  || fail "Agente Local       (4001)  — MORTO"
  check_port 3001  health && ok "MCP Server         (3001)"  || warn "MCP Server         (3001)  — inativo"
  check_port 4000  health && ok "API REST           (4000)"  || warn "API REST           (4000)  — inativo"
  ps aux | grep -q '[b]ot.js' && ok "Bot Telegram       (bot.js)" || fail "Bot Telegram       (bot.js) — MORTO"
  echo ""
  free -h | grep Mem | awk '{printf "  RAM: %s usado / %s dispon\303\255vel\n", $3, $7}'
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  exit 0
fi

# ── Modo --restart: mata processos existentes ────────────────────────
if [ "$1" = "--restart" ]; then
  echo ""
  warn "Encerrando serviços existentes..."
  pkill -f 'llama-server' 2>/dev/null
  pkill -f 'workspace_agent_server.js' 2>/dev/null
  pkill -f 'ollama_agent.js' 2>/dev/null
  pkill -f 'mcp_server.js' 2>/dev/null
  pkill -f 'bot.js' 2>/dev/null
  sleep 3
  ok "Serviços encerrados. Reiniciando..."
fi

# ── INÍCIO DA SUBIDA ─────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Workspace Mobile — Inicializando"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── [1/5] llama-server ──────────────────────────────────────────
if check_port 11434 health; then
  ok "llama-server já ativo (11434)"
else
  if [ ! -f "$MODEL" ]; then
    fail "Modelo não encontrado: $MODEL"
    exit 1
  fi
  echo "  Subindo llama-server..."
  nohup llama-server \
    --model "$MODEL" \
    --ctx-size 1024 \
    --port 11434 \
    --host 127.0.0.1 \
    --threads 4 \
    --batch-size 64 \
    --no-mmap \
    > "$LOGS/llama_server.log" 2>&1 &
  for i in $(seq 1 15); do
    sleep 1
    check_port 11434 health && break
  done
  check_port 11434 health && ok "llama-server online (11434)" || { fail "llama-server falhou. Ver $LOGS/llama_server.log"; exit 1; }
fi

# ── [2/5] Workspace Agent Server (MCP Universal) ─────────────────
if check_port 3333 health; then
  ok "Workspace Agent já ativo (3333)"
else
  echo "  Subindo Workspace Agent Server..."
  cd "$CORE" && nohup node workspace_agent_server.js \
    > "$LOGS/workspace_agent.log" 2>&1 &
  sleep 4
  check_port 3333 health && ok "Workspace Agent online (3333)" || warn "Workspace Agent lento — verificar $LOGS/workspace_agent.log"
fi

# ── [3/5] Agente Local ──────────────────────────────────────────
if check_port 4001 ""; then
  ok "Agente Local já ativo (4001)"
else
  echo "  Subindo Agente Local..."
  cd "$CORE" && nohup node ollama_agent.js \
    > "$LOGS/agent.log" 2>&1 &
  sleep 4
  check_port 4001 "" && ok "Agente Local online (4001)" || warn "Agente Local lento — verificar $LOGS/agent.log"
fi

# ── [4/5] MCP Server ─────────────────────────────────────────────
if check_port 3001 health; then
  ok "MCP Server já ativo (3001)"
else
  echo "  Subindo MCP Server..."
  cd "$CORE" && nohup node mcp_server.js \
    > "$LOGS/mcp_server.log" 2>&1 &
  sleep 3
  check_port 3001 health && ok "MCP Server online (3001)" || warn "MCP Server — verificar $LOGS/mcp_server.log"
fi

# ── [5/5] Bot Telegram ──────────────────────────────────────────
if ps aux | grep -q '[b]ot.js'; then
  ok "Bot Telegram já ativo"
else
  echo "  Subindo Bot Telegram..."
  cd "$BOT" && nohup node bot.js \
    > "$LOGS/bot.log" 2>&1 &
  sleep 3
  ps aux | grep -q '[b]ot.js' && ok "Bot Telegram online" || warn "Bot Telegram — verificar $LOGS/bot.log"
fi

# ── Resumo final ──────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
free -h | grep Mem | awk '{printf "  RAM: %s usado / %s dispon\303\255vel\n", $3, $7}'
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
