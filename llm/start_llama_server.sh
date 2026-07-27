#!/data/data/com.termux/files/usr/bin/bash
# =============================================================
# start_llama_server.sh — Inicia llama-server (substituto Ollama)
# Modelo: Qwen 2.5 0.5B Q4_K_M
# Porta: 11434 (compativel com a arquitetura existente)
# v2.2: --ubatch-size 512 para suportar embeddings de documentos
# =============================================================
# NOTAS DE FLAGS:
#   --embeddings       : Habilita endpoint POST /v1/embeddings
#   --pooling mean     : Estrategia de pooling compativel com OAI para Qwen
#   --batch-size 512   : Batch logico para processamento paralelo
#   --ubatch-size 512  : Batch FISICO — define o maximo de tokens por
#                        requisicao de embedding. Sem isso, chunks de
#                        64+ tokens falham com HTTP 500.
#   --ctx-size 2048    : Aumentado para acomodar documentos maiores
#   --no-mmap          : Evita swap excessivo no Android
# =============================================================

MODEL="/storage/emulated/0/Workspace/Models/qwen2.5-0.5b-instruct-q4_k_m.gguf"
PORT=11434
CTX=2048
THREADS=4
BATCH=512
UBATCH=512

if [ ! -f "$MODEL" ]; then
  echo "[ERRO] Modelo nao encontrado: $MODEL"
  exit 1
fi

echo "[llama-server] Iniciando Qwen 0.5B Q4 na porta $PORT (embeddings=ON, pooling=mean, ubatch=$UBATCH)..."
exec llama-server \
  --model "$MODEL" \
  --ctx-size $CTX \
  --port $PORT \
  --host 127.0.0.1 \
  --threads $THREADS \
  --batch-size $BATCH \
  --ubatch-size $UBATCH \
  --no-mmap \
  --embeddings \
  --pooling mean
