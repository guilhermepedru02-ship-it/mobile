#!/data/data/com.termux/files/usr/bin/bash
# ws-protect v2.0 — Anti-zumbi TTS + renice nos processos críticos
# Chamado pelo bootstrap após subida dos serviços E pelo loop while-true
# Uso: bash Scripts/core/ws-protect.sh
# NOTA: oom_score_adj exige root no Android — não tentamos escrever.
# Proteção real: wake-lock + renice + eliminação de zumbis TTS.

echo "[ws-protect v2.0] Iniciando..."

# ── 1. LIMPAR ZUMBIS TTS ─────────────────────────────────────────────────────
# TTS acumulados são a principal causa de load alto → signal9
TTS_COUNT=$(pgrep -fc 'termux-tts-speak' 2>/dev/null || echo 0)
TEXTTOS_COUNT=$(pgrep -fc 'TextToSpeech' 2>/dev/null || echo 0)

if [ "${TTS_COUNT:-0}" -gt 2 ]; then
  pkill -f 'termux-tts-speak' 2>/dev/null
  echo "[OK] $TTS_COUNT zumbi(s) termux-tts-speak eliminados"
fi
if [ "${TEXTTOS_COUNT:-0}" -gt 2 ]; then
  pkill -f 'TextToSpeech' 2>/dev/null
  echo "[OK] $TEXTTOS_COUNT zumbi(s) TextToSpeech eliminados"
fi

# ── 2. RENICE NOS PROCESSOS CRÍTICOS (node + bash wrapper) ───────────────────
SERVICES=(
  "llama-server:Llama Server"
  "mcp_server.js:MCP Server"
  "workspace_agent_server.js:Workspace Agent"
  "android_bridge.js:Android Bridge"
)

for entry in "${SERVICES[@]}"; do
  pattern="${entry%%:*}"
  label="${entry##*:}"
  PIDS=$(pgrep -f "$pattern" 2>/dev/null | tr '\n' ' ')
  if [ -n "$PIDS" ]; then
    for PID in $PIDS; do
      renice -n -10 -p "$PID" > /dev/null 2>&1
    done
    echo "[OK] $label (PIDs:$PIDS) renice -10"
  else
    echo "[SKIP] $label — não encontrado"
  fi
done

# ── 3. WAKE-LOCK ─────────────────────────────────────────────────────────────
termux-wake-lock 2>/dev/null && echo "[OK] wake-lock ativo" || echo "[WARN] wake-lock indisponível"

echo "[ws-protect v2.0] Concluído."
