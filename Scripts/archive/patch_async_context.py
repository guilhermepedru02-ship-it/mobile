path = '/storage/emulated/0/Workspace/Scripts/core/context_builder.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# 1. buildRAGContext vira async e usa await
OLD_RAG = '''// RAG CONTEXT BUILDER
function buildRAGContext(userPrompt) {
    const semantic = semanticSearch(userPrompt, 2);'''
NEW_RAG = '''// RAG CONTEXT BUILDER
async function buildRAGContext(userPrompt) {
    const semantic = await semanticSearch(userPrompt, 2);'''
if OLD_RAG in content:
    content = content.replace(OLD_RAG, NEW_RAG)
    changes += 1
    print('buildRAGContext -> async OK')
else:
    print('AVISO: buildRAGContext nao encontrada')

# 2. buildContext vira async e usa await buildRAGContext
OLD_BC = 'export function buildContext('
NEW_BC = 'export async function buildContext('
if OLD_BC in content:
    content = content.replace(OLD_BC, NEW_BC, 1)
    changes += 1
    print('buildContext -> async OK')
else:
    print('AVISO: buildContext export nao encontrado')

# 3. await na chamada de buildRAGContext dentro de buildContext
OLD_CALL = 'const ragContext = buildRAGContext('
NEW_CALL = 'const ragContext = await buildRAGContext('
if OLD_CALL in content:
    content = content.replace(OLD_CALL, NEW_CALL)
    changes += 1
    print('await buildRAGContext OK')
else:
    print('AVISO: chamada buildRAGContext nao encontrada')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f'{changes} alteracoes aplicadas em context_builder.js')
