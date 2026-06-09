path = '/storage/emulated/0/Workspace/Scripts/core/context_builder.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Substitui import MiniSearch por import do vector_db_v2
OLD_IMPORT = "import MiniSearch from 'minisearch';"
NEW_IMPORT = "import { search as vectorSearch } from './vector_db_v2.js';"

# 2. Substitui a funcao semanticSearch inteira por delegacao ao vector_db_v2
OLD_SEARCH = '''// ============================================================
// BUSCA SEMANTICA (MiniSearch) — com filtro de blacklist
// ============================================================
function semanticSearch(query, topK = 2) {
    if (!fs.existsSync(CACHE_PATH)) return null;
    try {
        const indexJson  = fs.readFileSync(CACHE_PATH, 'utf8');
        const miniSearch = MiniSearch.loadJSON(indexJson, {
            fields: ['text'],
            storeFields: ['file', 'text']
        });
        const results = miniSearch.search(query, { fuzzy: 0.2, prefix: true });
        return results
            .filter(r => !isRAGBlacklisted(r.file))
            .slice(0, topK)
            .map(r => ({ file: r.file, excerpt: r.text.slice(0, 200) }));
    } catch { return null; }
}'''

NEW_SEARCH = '''// ============================================================
// BUSCA SEMANTICA v2 — vetorial (embeddings) com fallback keyword
// Delega ao vector_db_v2.js (FASE 4)
// ============================================================
async function semanticSearch(query, topK = 2) {
    try {
        const res = await vectorSearch(query, topK + 2);
        if (!res.success || !res.results?.length) return null;
        return res.results
            .filter(r => !isRAGBlacklisted(r.file))
            .slice(0, topK)
            .map(r => ({ file: r.file, excerpt: r.excerpt ?? r.text?.slice(0, 200) ?? '', mode: res.mode }));
    } catch { return null; }
}'''

if OLD_IMPORT not in content:
    print('ERRO: import MiniSearch nao encontrado')
elif OLD_SEARCH not in content:
    print('ERRO: funcao semanticSearch nao encontrada')
    # Mostra trecho para debug
    idx = content.find('semanticSearch')
    print(repr(content[idx-50:idx+300]))
else:
    content = content.replace(OLD_IMPORT, NEW_IMPORT)
    content = content.replace(OLD_SEARCH, NEW_SEARCH)
    # Remove CACHE_PATH se nao usado em outro lugar
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print('context_builder.js atualizado para vector_db_v2 OK')
