path = '/storage/emulated/0/Workspace/Scripts/core/vector_db_v2.js'
with open(path, 'r', encoding='utf-8') as f:
    c = f.read()

# Chunk menor: 180 chars ~ 45 tokens (bem abaixo do limite de 64)
c = c.replace('const CHUNK_SIZE    = 300;', 'const CHUNK_SIZE    = 180;')
c = c.replace('const CHUNK_OVERLAP = 50;',  'const CHUNK_OVERLAP = 30;')

# Input do embedding limitado a 200 chars para garantir < 50 tokens
c = c.replace(
    'body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 2000) })',
    'body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 200) })'
)

with open(path, 'w', encoding='utf-8') as f:
    f.write(c)

print('CHUNK_SIZE->180, OVERLAP->30, embed input->200 OK')
