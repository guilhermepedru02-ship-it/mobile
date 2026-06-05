import urllib.request, json, os, time
from pathlib import Path

# =============================================================
# index_cerebro.py v1.2 — Indexação vetorial do Cérebro
# FIX BUG #3: timeout 20s -> 45s + retry com backoff exponencial
# Retry: 3 tentativas, backoff 2s/4s antes de desistir
# CORRIGIDO: 00_Sistema e 01_Planejamento REMOVIDOS conforme
# RAG blacklist (decisoes_tecnicas.md 31/05/2026)
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

EXCLUDE_PATTERNS = ['wm_', '_consolidated.json']

# --- FIX BUG #3: timeout aumentado + retry com backoff ---
TIMEOUT_S  = 45   # era 20s — arquivos grandes com llama-server sob carga precisam de mais tempo
MAX_RETRY  = 3    # tentativas por chunk antes de desistir
RETRY_WAIT = 2    # segundos base para backoff exponencial

def get_embedding(text, attempt=1):
    """Gera embedding com retry e backoff exponencial."""
    try:
        req = urllib.request.Request(
            'http://127.0.0.1:11434/v1/embeddings',
            data=json.dumps({'model': MODEL, 'input': text[:400]}).encode(),
            headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
            d = json.load(r)
        return d['data'][0]['embedding']
    except Exception as e:
        if attempt < MAX_RETRY:
            wait = RETRY_WAIT * (2 ** (attempt - 1))  # 2s, 4s
            print(f'    [RETRY {attempt}/{MAX_RETRY}] Aguardando {wait}s... ({str(e)[:60]})')
            time.sleep(wait)
            return get_embedding(text, attempt + 1)
        raise  # re-raise na última tentativa

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

print('=== INDEXAÇÃO VETORIAL v1.2 — Cérebro ===')
print(f'Timeout: {TIMEOUT_S}s | Retry: {MAX_RETRY}x com backoff {RETRY_WAIT}s')
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
pulados = []

for fp in files:
    abs_fp = os.path.join(WORKSPACE, fp)
    try:
        content = open(abs_fp, encoding='utf-8').read().strip()
        if len(content) < 20:
            continue
        file_chunks = chunk_text(content)
        n = len(file_chunks)
        print(f'  Indexando: {fp} ({n} chunks)...')
        file_ok = 0
        for i, chunk in enumerate(file_chunks):
            try:
                vec = get_embedding(chunk)
                chunks.append({'id': f'{fp}#{i}', 'file': fp, 'text': chunk, 'vector': vec})
                ok += 1
                file_ok += 1
            except Exception as ce:
                erros += 1
                print(f'    [ERRO chunk {i}] {str(ce)[:80]}')
        if file_ok < n:
            pulados.append(f'{fp} ({file_ok}/{n} chunks)')
    except Exception as e:
        erros += 1
        print(f'  ERRO {fp}: {str(e)[:100]}')
        pulados.append(fp)

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
if pulados:
    print(f'Arquivos com falhas parciais ({len(pulados)}):')
    for p in pulados:
        print(f'  - {p}')
print(f'Cache: {CACHE_PATH}')
