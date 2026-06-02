import urllib.request, json, os, time
from pathlib import Path

# =============================================================
# index_cerebro.py v1.1 — Indexação vetorial do Cérebro
# CORRIGIDO: 00_Sistema e 01_Planejamento REMOVIDOS conforme
# RAG blacklist (decisoes_tecnicas.md 31/05/2026)
# Dirs válidos: apenas fontes de contexto RAG legítimas
# =============================================================

WORKSPACE = '/storage/emulated/0/Workspace'
CEREBRO_DIRS = [
    'Cerebro/02_Memoria',
    'Cerebro/03_Tarefas',
    'Cerebro/04_Diario',
    'Cerebro/Memoria-RAG',
]
CHUNK_SIZE = 180
OVERLAP = 30
MODEL = 'qwen2.5-0.5b-instruct-q4_k_m.gguf'
CACHE_PATH = os.path.join(WORKSPACE, 'Cerebro', '.vector_cache_v2.json')

# Arquivos a ignorar na indexação RAG (wm_*.json são working memory bruta)
EXCLUDE_PATTERNS = ['wm_', '_consolidated.json']

def get_embedding(text):
    req = urllib.request.Request(
        'http://127.0.0.1:11434/v1/embeddings',
        data=json.dumps({'model': MODEL, 'input': text[:400]}).encode(),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        d = json.load(r)
    return d['data'][0]['embedding']

def chunk_text(text, size=CHUNK_SIZE, overlap=OVERLAP):
    chunks = []
    start = 0
    while start < len(text):
        chunks.append(text[start:start+size])
        start += size - overlap
    return chunks

def should_exclude(filename):
    for pat in EXCLUDE_PATTERNS:
        if pat in filename:
            return True
    return False

def collect_files():
    files = []
    for d in CEREBRO_DIRS:
        abs_d = os.path.join(WORKSPACE, d)
        if not os.path.exists(abs_d):
            print(f'  [SKIP] Diretório não encontrado: {d}')
            continue
        for f in Path(abs_d).rglob('*.md'):
            rel = str(f.relative_to(WORKSPACE))
            if should_exclude(f.name):
                continue
            files.append(rel)
    return files

print('=== INDEXAÇÃO VETORIAL v1.1 — Cérebro ===')
print(f'Dirs: {CEREBRO_DIRS}')
print(f'Cache: {CACHE_PATH}')
start = time.time()

files = collect_files()
print(f'Arquivos encontrados: {len(files)}')
for f in files:
    print(f'  {f}')

chunks = []
ok = 0
erros = 0
for fp in files:
    abs_fp = os.path.join(WORKSPACE, fp)
    try:
        content = open(abs_fp, encoding='utf-8').read().strip()
        if len(content) < 20:
            continue
        file_chunks = chunk_text(content)
        print(f'  Indexando: {fp} ({len(file_chunks)} chunks)...')
        for i, chunk in enumerate(file_chunks):
            vec = get_embedding(chunk)
            chunks.append({'id': f'{fp}#{i}', 'file': fp, 'text': chunk, 'vector': vec})
            ok += 1
    except Exception as e:
        erros += 1
        print(f'  ERRO {fp}: {str(e)[:100]}')

cache = {
    'mode': 'vector',
    'version': '2.0.0',
    'indexed_at': time.strftime('%Y-%m-%dT%H:%M:%SZ'),
    'embed_dim': 896,
    'total_chunks': len(chunks),
    'chunks': chunks
}

with open(CACHE_PATH, 'w', encoding='utf-8') as f:
    json.dump(cache, f, ensure_ascii=False)

elapsed = time.time() - start
print(f'=== CONCLUÍDO ===')
print(f'Chunks: {ok} | Erros: {erros} | Tempo: {elapsed:.1f}s')
print(f'Cache: {CACHE_PATH}')
