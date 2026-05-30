#!/bin/bash
# ===========================================
#  Túnel SSH para exposição do Workspace
#  Usa Serveo.net (sem instalação de binarios)
#  Auto-gerencia o NGROK_MODE no .env
# ===========================================

ENV_FILE="/storage/emulated/0/Workspace/Projetos/telegram_bot/.env"

# Função que ativa o NGROK_MODE no .env
activate_ngrok_mode() {
  sed -i 's/NGROK_MODE=false/NGROK_MODE=true/' "$ENV_FILE"
  echo "[.env] NGROK_MODE ativado automaticamente."
}

# Função que desativa o NGROK_MODE no .env
deactivate_ngrok_mode() {
  sed -i 's/NGROK_MODE=true/NGROK_MODE=false/' "$ENV_FILE"
  echo ""
  echo "[.env] NGROK_MODE desativado automaticamente."
  echo "Túnel encerrado com segurança."
}

# Captura Ctrl+C para desativar o NGROK_MODE antes de sair
trap deactivate_ngrok_mode EXIT

MODE=${1:-mcp}

echo ""
echo "╔═════════════════════════════════════════╗"
echo "║   WORKSPACE TUNNEL - Serveo.net        ║"
echo "║   Ctrl+C para encerrar com segurança  ║"
echo "╚═════════════════════════════════════════╝"
echo ""

# Ativa o NGROK_MODE antes de abrir o túnel
activate_ngrok_mode

if [ "$MODE" = "mcp" ]; then
    PORT=3001
    echo "[MODE] Expondo MCP Server (porta $PORT)"
    echo "[DICA] IAs externas conectam via a URL abaixo."
    echo ""
    ssh -o StrictHostKeyChecking=no -R 80:localhost:$PORT serveo.net

elif [ "$MODE" = "api" ]; then
    PORT=4000
    echo "[MODE] Expondo API REST (porta $PORT)"
    echo "[DICA] Automações externas conectam via a URL abaixo."
    echo ""
    ssh -o StrictHostKeyChecking=no -R 80:localhost:$PORT serveo.net

elif [ "$MODE" = "both" ]; then
    echo "[MODE] Expondo MCP (3001) e API REST (4000)"
    echo ""
    ssh -o StrictHostKeyChecking=no -R 80:localhost:3001 serveo.net &
    PID1=$!
    sleep 3
    ssh -o StrictHostKeyChecking=no -R 80:localhost:4000 serveo.net &
    PID2=$!
    echo ""
    echo "Túneis ativos. Pressione Ctrl+C para encerrar."
    wait

else
    echo "Uso: bash start_tunnel.sh [mcp|api|both]"
    deactivate_ngrok_mode
    exit 1
fi