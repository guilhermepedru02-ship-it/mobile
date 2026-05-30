#!/data/data/com.termux/files/usr/bin/bash
# Monitor de inferência local — llama-server (atualizado 2026-05-30)
LOG=/storage/emulated/0/Workspace/Logs/monitor_during_gen.log
OUT=/storage/emulated/0/Workspace/Logs/generate_response.json
rm -f "$LOG" "$OUT"
(
  while true; do
    date -Is >> "$LOG"
    free -h | grep Mem >> "$LOG"
    ps aux | grep '[l]lama-server' >> "$LOG"
    sleep 1
  done
) & MON=$!
curl -s --max-time 55 \
  -H 'Content-Type: application/json' \
  -X POST http://127.0.0.1:11434/v1/chat/completions \
  -d '{"model":"qwen2.5-0.5b","messages":[{"role":"user","content":"Teste de carga do pipeline."}],"max_tokens":64,"stream":false}' \
  > "$OUT" 2>&1
RET=$?
kill $MON 2>/dev/null
echo "CURL_EXIT:$RET"
cat "$LOG"
cat "$OUT"
