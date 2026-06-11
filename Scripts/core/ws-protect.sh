#!/data/data/com.termux/files/usr/bin/bash
# ws-protect — Protege processos críticos do Android OOM Killer via renice
# Chamado pelo boot do Termux após os serviços subirem
# Uso: bash ws-protect  ou  ws-protect (se no PATH)

SERVICES=(
  "mcp_server.js:MCP Server"
  "llama-server:Llama Server"
  "workspace_agent:Workspace Agent"
  "android_bridge:Android Bridge"
)

echo "[ws-protect] Aplicando proteção OOM nos processos críticos..."

for entry in "${SERVICES[@]}"; do
  pattern="${entry%%:*}"
  label="${entry##*:}"
  PID=$(pgrep -f "$pattern" | grep -v bash | head -1)
  if [ -n "$PID" ]; then
    renice -n -10 -p "$PID" > /dev/null 2>&1 && echo "[OK] $label (PID $PID) protegido"
  else
    echo "[SKIP] $label não encontrado"
  fi
done

echo "[ws-protect] Concluído."
