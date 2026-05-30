#!/bin/bash
# Script para iniciar os túneis Ngrok

if ! command -v ngrok &> /dev/null
then
    echo "Erro: O 'ngrok' não está instalado no Termux."
    echo "Para instalar, siga o guia oficial do Ngrok para Linux/ARM64."
    exit 1
fi

echo "==========================================="
echo "Iniciando Ngrok para MCP Server e API REST"
echo "==========================================="

echo ""
echo "[OPÇÃO 1] Expor apenas o MCP Server (Porta 3001)"
echo "Comando: ngrok http 3001"
echo ""
echo "[OPÇÃO 2] Expor apenas a API REST (Porta 4000)"
echo "Comando: ngrok http 4000"
echo ""
echo "Nota: O plano gratuito do Ngrok só permite 1 túnel por vez."
echo "Copie a URL HTTPS fornecida pelo ngrok e use nas integrações!"
echo "Lembre-se de definir NGROK_MODE=true no seu arquivo .env para exigir a API KEY."
