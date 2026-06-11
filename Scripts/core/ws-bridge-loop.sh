#!/data/data/com.termux/files/usr/bin/bash
# ws-bridge-loop.sh — Loop resiliente do android_bridge com anti-zumbi TTS
# Executado dentro do tmux window 'bridge'
CORE='/storage/emulated/0/Workspace/Scripts/core'
LOGS='/storage/emulated/0/Workspace/Logs'

while true; do
  # Limpa zumbis TTS antes de subir
  pkill -f 'termux-tts-speak' 2>/dev/null
  pkill -f 'TextToSpeech' 2>/dev/null

  # Sobe o bridge
  cd "$CORE" && NODE_OPTIONS=--max-old-space-size=80 node android_bridge.js >> "$LOGS/android_bridge.log" 2>&1

  # Após morte/restart: aplica renice + wake-lock
  bash "$CORE/ws-protect.sh" >> "$LOGS/protect.log" 2>&1

  sleep 5
done
