import urllib.request, json
req = urllib.request.Request(
    'http://127.0.0.1:11434/v1/embeddings',
    data=json.dumps({'model':'qwen2.5-0.5b-instruct-q4_k_m.gguf','input':'teste'}).encode(),
    headers={'Content-Type':'application/json'}
)
with urllib.request.urlopen(req, timeout=10) as r:
    d = json.load(r)
v = d.get('data',[{}])[0].get('embedding',[])
if v:
    print(f'EMBEDDINGS OK — dim: {len(v)} | amostra: {v[:3]}')
else:
    print('ERRO:', d)
