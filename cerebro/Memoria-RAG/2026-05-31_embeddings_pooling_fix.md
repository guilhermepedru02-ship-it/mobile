# RAG — 2026-05-31: Correção Embeddings + Pooling Mean
**Agente:** Claude Sonnet 4.6 via MCP Workspace-Telemovel
**Categoria:** embeddings, rag-vetorial, llama-server, fase4

---

## Problema identificado

O `llama-server` foi iniciado com `--embeddings` mas SEM `--pooling mean`. O Qwen 0.5B usa mean-pooling como estratégia para gerar o vetor final de um texto — sem essa flag, o servidor não sabe como agregar os token embeddings em um único vetor de saída, resultando em erro de pooling no endpoint `/v1/embeddings`.

## Causa raiz

llama-server exige que o tipo de pooling seja declarado explicitamente quando `--embeddings` está ativo. Para modelos Qwen (e maioria dos transformers decoder-only), a estratégia correta é `mean` (média de todos os token embeddings). Sem a flag, o servidor não consegue calcular o embedding do texto e retorna erro.

## Correção aplicada

### `Scripts/core/start_llama_server.sh` — v2.1
```bash
# ANTES (com erro de pooling):
exec llama-server \ ...
  --embeddings

# DEPOIS (correto):
exec llama-server \ ...
  --embeddings \
  --pooling mean
```

### `Scripts/bootstrap/03_start_services.sh` — v2.1
- Seção [1/5] sincronizada com as mesmas flags
- Adicionado check de embeddings no `--status` (testa `/v1/embeddings` com payload real)
- Adicionado lembrete de reindexar com `vector_db_v2.js` após restart

## Impacto prático após restart

Com `--pooling mean` ativo:
- `/v1/embeddings` retorna vetor de 896 dimensões (n_embd do Qwen 0.5B)
- `vector_db_v2.js` consegue chamar `getEmbedding()` sem erro
- A reindexacão criara `.vector_cache_v2.json` com vetores reais
- Buscas como "soberania de dados" encontrarão "autonomia local", "controle privado" semanticamente

## Passos pós-deploy (Guilherme faz no Termux)

```bash
# 1. Reiniciar com novas flags:
ws-restart
# OU manualmente:
pkill -f llama-server && bash Scripts/core/start_llama_server.sh &

# 2. Verificar embeddings:
curl -s -X POST http://127.0.0.1:11434/v1/embeddings \
  -H 'Content-Type: application/json' \
  -d '{"model":"qwen2.5-0.5b","input":"teste de embedding"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'OK: {len(d[\"data\"][0][\"embedding\"])} dims')"
# Esperado: OK: 896 dims

# 3. Reindexar o Cerebro com vetores reais:
cd /storage/emulated/0/Workspace
node -e "import('./Scripts/core/vector_db_v2.js').then(m => m.indexCerebro().then(r => console.log(JSON.stringify(r, null, 2))))"
# Esperado: mode: 'vector', chunks: N
```

## Palavras-chave
#embeddings #pooling-mean #llama-server #qwen #fase4 #rag-vetorial #vector-db-v2 #correcao-critica
