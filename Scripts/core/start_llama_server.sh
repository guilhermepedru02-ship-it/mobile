#!/data/data/com.termux/files/usr/bin/bash
# =============================================================
# start_llama_server.sh — Inicia llama-server (substituto Ollama)
# Modelo: Qwen 2.5 0.5B Q4_K_M
# Porta: 11434 (compativel com a arquitetura existente)
# v2.1: --pooling mean adicionado para compatibilidade OAI embeddings
# =============================================================
# NOTAS DE FLAGS:
#   --embeddings     : Habilita endpoint POST /v1/embeddings
#   --pooling mean   : Estratégia de pooling compatível com OAI para Qwen
#                      Sem isso, o endpoint retorna erro de pooling type.
#                      Qwen 0.5B usa mean-pooling (média dos token embeddings)
#   --no-mmap        : Evita swap excessivo no Android (carrega direto na RAM)
#   --ctx-size 1024  : Margem suficiente para kanban + system prompt + resposta
# =============================================================

MODEL="/storage/emulated/0/Workspace/Models/qwen2.5-0.5b-instruct-q4_k_m.gguf"
PORT=11434
CTX=1024
THREADS=4
BATCH=64

if [ ! -f "$MODEL" ]; then
  echo "[ERRO] Modelo nao encontrado: $MODEL"
  exit 1
fi

echo "[llama-server] Iniciando Qwen 0.5B Q4 na porta $PORT (embeddings=ON, pooling=mean)..."
exec llama-server \
  --model "$MODEL" \
  --ctx-size $CTX \
  --port $PORT \
  --host 127.0.0.1 \
  --threads $THREADS \
  --batch-size $BATCH \
  --no-mmap \
  --embeddings \
  --pooling mean
