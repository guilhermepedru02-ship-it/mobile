import urllib.request, json

# Testa embedding com texto de tamanho real (simula chunk de documento)
textos = [
    'soberania de dados arquitetura local Android',
    'Chronos Local IA soberana Qwen 0.5B llama-server embeddings vetoriais RAG',
    'FASE 4 vector_db_v2 busca semantica similaridade cosseno indexacao incremental'
]

print('=== Teste ubatch=512 ===')
for texto in textos:
    tokens_est = len(texto.split()) * 1.3  # estimativa
    try:
        req = urllib.request.Request(
            'http://127.0.0.1:11434/v1/embeddings',
            data=json.dumps({'model': 'qwen2.5-0.5b-instruct-q4_k_m.gguf', 'input': texto}).encode(),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=15) as r:
            d = json.load(r)
        v = d.get('data', [{}])[0].get('embedding', [])
        print(f'OK [{len(texto)} chars ~{tokens_est:.0f}tok] dim={len(v)}')
    except Exception as e:
        print(f'ERRO [{len(texto)} chars]: {e}')

print('=== fim ===')
