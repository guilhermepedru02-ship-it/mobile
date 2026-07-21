# Chronos-VPS — LLM local via llama.cpp (server OpenAI-compatible)
FROM ghcr.io/ggml-org/llama.cpp:server

# Diretório onde os arquivos .gguf serão montados via volume (ver docker-compose.yml)
# NÃO copie modelos para dentro da imagem — eles são grandes e mudam com frequência.
VOLUME ["/models"]

EXPOSE 11434

# TAREFA JULES: confirmar tag/versão da imagem oficial llama.cpp mais recente
# no momento da implementação (a tag "server" pode ter sido renomeada).
# Baixar o modelo recomendado antes do primeiro start, ex:
#   huggingface-cli download Qwen/Qwen2.5-7B-Instruct-GGUF \
#     qwen2.5-7b-instruct-q4_k_m.gguf --local-dir ./llm/models
ENTRYPOINT ["/app/llama-server"]
CMD ["-m", "/models/qwen2.5-7b-instruct-q4_k_m.gguf", \
     "--host", "0.0.0.0", "--port", "11434", \
     "-c", "4096", "--n-gpu-layers", "0"]
