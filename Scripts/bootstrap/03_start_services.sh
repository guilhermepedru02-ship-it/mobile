#!/data/data/com.termux/files/usr/bin/bash
# =============================================================
# 03_start_services.sh — Chronos: Inicialização Resiliente
# v4.8 — slim mode + heaps calibrados anti-signal9
# Uso: ws | ws --status | ws --restart | ws --stop | ws --full
# NODE_OPTIONS por serviço:
#   mcp_server        192 MB  (SDK MCP + Express + handlers)
#   workspace_agent   120 MB  (agent HTTP server)
#   android_bridge     80 MB  (bridge leve)
#   ollama_agent       60 MB  (bot mode slim)
#   bot.js             60 MB  (telegram bot)
# =============================================================

CORE="/storage/emulated/0/Workspace/Scripts/core"
LOGS="/storage/emulated/0/Workspace/Logs"
MODEL="/storage/emulated/0/Workspace/Models/qwen2.5-0.5b-instruct-q4_k_m.gguf"
BOT="/storage/emulated/0/Workspace/Projetos/telegram_bot"
SESSION="chronos"

mkdir -p "$LOGS"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  [OK]${NC} $1"; }
warn() { echo -e "${YELLOW}  [!!]${NC} $1"; }
fail() { echo -e "${RED}  [XX]${NC} $1"; }
info() { echo -e "${CYAN}  [--]${NC} $1"; }

check_port() {
  curl -s --max-time 3 "http://127.0.0.1:$1/$2" > /dev/null 2>&1
}

protect_pid() {
  local pid=$1
  local score=${2:--900}
  echo "$score" > "/proc/$pid/oom_score_adj" 2>/dev/null && return 0
  return 1
}

# ── Modo --stop ────────────────────────────────────────────────
if [ "$1" = "--stop" ]; then
  echo ""
  warn "Encerrando sessão tmux '$SESSION' e todos os serviços..."
  tmux kill-session -t "$SESSION" 2>/dev/null
  pkill -f 'llama-server'              2>/dev/null
  pkill -f 'workspace_agent_server.js' 2>/dev/null
  pkill -f 'ollama_agent.js'           2>/dev/null
  pkill -f 'mcp_server.js'             2>/dev/null
  pkill -f 'bot.js'                    2>/dev/null
  pkill -f 'android_bridge.js'         2>/dev/null
  pkill -f 'api_rest.js'               2>/dev/null
  pkill -f 'chronos_watchdog'          2>/dev/null
  ok "Chronos encerrado."
  echo ""
  exit 0
fi

# ── Modo --status ────────────────────────────────────────────
if [ "$1" = "--status" ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Chronos — Saúde dos Serviços"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  tmux has-session -t "$SESSION" 2>/dev/null && ok "tmux session '$SESSION' ativa" || warn "tmux session '$SESSION' — AUSENTE"
  check_port 11434 health && ok "llama-server       (11434)" || fail "llama-server       (11434) — MORTO"
  check_port 3333  health && ok "Workspace Agent    (3333)"  || fail "Workspace Agent    (3333)  — MORTO"
  check_port 4001  ""     && ok "Agente Local       (4001)"  || fail "Agente Local       (4001)  — MORTO"
  check_port 3001  health && ok "MCP Server         (3001)"  || warn "MCP Server         (3001)  — inativo"
  ps aux | grep -q '[b]ot.js' && ok "Bot Telegram       (bot.js)" || fail "Bot Telegram       (bot.js) — MORTO"
  check_port 4444 "bridge/status" && ok "Android Bridge     (4444)" || warn "Android Bridge     (4444)  — inativo"
  echo ""
  free -h | grep Mem  | awk '{printf "  RAM:  %s usado / %s disponivel\n", $3, $7}'
  free -h | grep Swap | awk '{printf "  Swap: %s usado / %s total\n", $3, $2}'
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  exit 0
fi

# ── Modo --restart ───────────────────────────────────────────
if [ "$1" = "--restart" ]; then
  warn "Reiniciando — encerrando serviços existentes..."
  tmux kill-session -t "$SESSION" 2>/dev/null
  pkill -f 'llama-server'              2>/dev/null
  pkill -f 'workspace_agent_server.js' 2>/dev/null
  pkill -f 'ollama_agent.js'           2>/dev/null
  pkill -f 'mcp_server.js'             2>/dev/null
  pkill -f 'bot.js'                    2>/dev/null
  pkill -f 'android_bridge.js'         2>/dev/null
  pkill -f 'api_rest.js'               2>/dev/null
  pkill -f 'chronos_watchdog'          2>/dev/null
  sleep 3
  ok "Serviços encerrados. Reiniciando em nova sessão tmux..."
fi

# ════════════════════════════════════════════════════════════
#  INÍCIO DA SUBIDA
# ════════════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Chronos — Inicializando v4.8 (slim: llama+ws-agent+mcp+bridge)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ! command -v tmux &>/dev/null; then
  info "tmux não encontrado — instalando..."
  apt-get install -y tmux > /dev/null 2>&1
  command -v tmux &>/dev/null && ok "tmux instalado" || { fail "Falha ao instalar tmux. Execute: apt install tmux"; exit 1; }
fi

termux-wake-lock 2>/dev/null && info "wake-lock ativado" || true
termux-notification --id 1 --title "Chronos Workspace" --content "Stack slim ativa — protegido do LMKD" --ongoing --priority high 2>/dev/null && info "foreground notification ativa (anti-LMKD)" || warn "termux-notification indisponivel"

if tmux has-session -t "$SESSION" 2>/dev/null; then
  ok "Sessão tmux '$SESSION' já existe — reutilizando"
else
  tmux new-session -d -s "$SESSION" -x 220 -y 50
  ok "Sessão tmux '$SESSION' criada"
fi

tmux_run() {
  local name=$1; shift
  tmux new-window -t "$SESSION" -n "$name" "$@" 2>/dev/null || true
}

# ── [1/6] llama-server ───────────────────────────────────────────
if check_port 11434 health; then
  ok "llama-server já ativo (11434)"
else
  [ ! -f "$MODEL" ] && { fail "Modelo não encontrado: $MODEL"; exit 1; }
  info "Subindo llama-server..."
  tmux_run "llama" "llama-server \
    --model '$MODEL' \
    --ctx-size 256 \
    --port 11434 \
    --host 127.0.0.1 \
    --threads 2 \
    --batch-size 128 \
    --ubatch-size 128 \
    --no-mmap \
    --embeddings \
    --pooling mean \
    >> '$LOGS/llama_server.log' 2>&1"
  for i in $(seq 1 20); do sleep 1; check_port 11434 health && break; done
  check_port 11434 health && { ok "llama-server online (11434)"; protect_pid "$(pgrep llama-server | head -1)" -900; } || { fail "llama-server falhou — ver $LOGS/llama_server.log"; exit 1; }
fi

# ── [2/6] Workspace Agent (heap 120 MB) ────────────────────────
if check_port 3333 health; then
  ok "Workspace Agent já ativo (3333)"
else
  info "Subindo Workspace Agent..."
  tmux_run "ws-agent" "while true; do pkill -f 'termux-tts-speak' 2>/dev/null; pkill -f 'TextToSpeech' 2>/dev/null; cd $CORE && NODE_OPTIONS=--max-old-space-size=120 node workspace_agent_server.js >> $LOGS/workspace_agent.log 2>&1; bash /storage/emulated/0/Workspace/Scripts/core/ws-protect.sh >> $LOGS/protect.log 2>&1; sleep 5; done"
  sleep 4
  check_port 3333 health && { ok "Workspace Agent online (3333)"; protect_pid "$(pgrep -f workspace_agent_server.js | head -1)" -700; } || warn "Workspace Agent — ver $LOGS/workspace_agent.log"
fi

# ── [3/6] Agente Local (slim: sob demanda) ──────────────────────
if [ "$1" = "--full" ]; then
  if check_port 4001 ""; then
    ok "Agente Local já ativo (4001)"
  else
    info "Subindo Agente Local (modo --full)..."
    tmux_run "ollama" "while true; do cd $CORE && NODE_OPTIONS=--max-old-space-size=60 node ollama_agent.js >> $LOGS/agent.log 2>&1; sleep 5; done"
    sleep 4
    check_port 4001 "" && { ok "Agente Local online (4001)"; protect_pid "$(pgrep -f ollama_agent.js | head -1)" -700; } || warn "Agente Local — ver $LOGS/agent.log"
  fi
else
  info "Agente Local (4001) em modo slim — use ws-local para ativar"
fi

# ── [4/6] MCP Server (heap 192 MB — anti-signal9) ────────────────
if check_port 3001 health; then
  ok "MCP Server já ativo (3001)"
else
  info "Subindo MCP Server..."
  tmux_run "mcp" "while true; do pkill -f 'termux-tts-speak' 2>/dev/null; pkill -f 'TextToSpeech' 2>/dev/null; cd $CORE && NODE_OPTIONS=--max-old-space-size=192 node mcp_server.js >> $LOGS/mcp_server.log 2>&1; bash /storage/emulated/0/Workspace/Scripts/core/ws-protect.sh >> $LOGS/protect.log 2>&1; sleep 5; done"
  sleep 3
  check_port 3001 health && { ok "MCP Server online (3001)"; protect_pid "$(pgrep -f mcp_server.js | head -1)" -1000; } || warn "MCP Server — ver $LOGS/mcp_server.log"
fi

# ── [5/6] Bot Telegram (slim: sob demanda) ──────────────────────
if [ "$1" = "--full" ]; then
  if ps aux | grep -q '[b]ot.js'; then
    ok "Bot Telegram já ativo"
  else
    info "Subindo Bot Telegram (modo --full)..."
    tmux_run "bot" "while true; do cd $BOT && NODE_OPTIONS=--max-old-space-size=60 node $BOT/bot.js >> $LOGS/bot.log 2>&1; sleep 5; done"
    sleep 3
    ps aux | grep -q '[b]ot.js' && ok "Bot Telegram online" || warn "Bot Telegram — ver $LOGS/bot.log"
  fi
else
  info "Bot Telegram em modo slim — use ws-bot para ativar"
fi

# ── [6/6] Android Bridge (heap 80 MB) ───────────────────────────
if check_port 4444 "bridge/status"; then
  ok "Android Bridge já ativo (4444)"
else
  info "Subindo Android Bridge..."
  tmux_run "bridge" "while true; do pkill -f 'termux-tts-speak' 2>/dev/null; pkill -f 'TextToSpeech' 2>/dev/null; cd $CORE && NODE_OPTIONS=--max-old-space-size=80 node android_bridge.js >> $LOGS/android_bridge.log 2>&1; bash /storage/emulated/0/Workspace/Scripts/core/ws-protect.sh >> $LOGS/protect.log 2>&1; sleep 5; done"
  sleep 4
  check_port 4444 "bridge/status" && ok "Android Bridge online (4444)" || warn "Android Bridge — ver $LOGS/bridge.log"
fi

# ── Resumo final ─────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
free -h | grep Mem  | awk '{printf "  RAM:  %s usado / %s disponivel\n", $3, $7}'
free -h | grep Swap | awk '{printf "  Swap: %s usado / %s total\n", $3, $2}'
echo "  Stack slim 4/8 v4.8 — tmux session: $SESSION (use --full para 6/6)"
echo "  Use 'tmux attach -t $SESSION' para inspecionar"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
