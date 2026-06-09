import json, os

PATH = '/storage/emulated/0/Workspace/Scripts/core/tool_registry.json'

with open(PATH, 'r', encoding='utf-8') as f:
    registry = json.load(f)

# Nova ferramenta list_cerebro
new_tool = {
    "id": "list_cerebro",
    "description": "Lista a estrutura completa do Cerebro: arquivos .md por diretorio com tamanhos e contagens. Tambem mostra status dos caches vetoriais.",
    "trigger_keywords": [
        "listar cerebro",
        "lista cerebro",
        "ls cerebro",
        "arquivos do cerebro",
        "arquivos cerebro",
        "listar arquivos",
        "lista arquivos",
        "mostrar arquivos",
        "mostra arquivos",
        "estrutura cerebro",
        "estrutura do cerebro",
        "o que tem no cerebro",
        "conteudo cerebro",
        "conteudo do cerebro",
        "ver cerebro",
        "explorar cerebro",
        "pastas cerebro",
        "diretorios cerebro",
        "listar memoria",
        "listar diario",
        "listar rag"
    ],
    "type": "run_command",
    "command": "echo '=== CEREBRO — ESTRUTURA ===' && for d in 00_Sistema 01_Planejamento 02_Memoria 03_Tarefas 04_Diario Memoria-RAG; do base=/storage/emulated/0/Workspace/Cerebro/$d; if [ -d \"$base\" ]; then count=$(find \"$base\" -name '*.md' | wc -l); echo \"\"; echo \"[$d] ($count arquivos .md):\"; find \"$base\" -maxdepth 2 -name '*.md' | sort | while read f; do kb=$(( ($(wc -c < \"$f\") + 512) / 1024 )); name=$(basename \"$f\"); echo \"  $name (${kb}KB)\"; done; fi; done && echo '' && echo '=== CACHES VETORIAIS ===' && ls -lh /storage/emulated/0/Workspace/Cerebro/.vector_cache*.json 2>/dev/null && echo ''",
    "output": "text"
}

# Inserir apos kanban_read (indice 6, entre kanban_read e git_status)
tools = registry['tools']
idx = next((i for i, t in enumerate(tools) if t['id'] == 'kanban_read'), None)
insert_at = (idx + 1) if idx is not None else len(tools)
tools.insert(insert_at, new_tool)

# Atualizar metadata
registry['version'] = '2.7.2'
registry['description'] = 'Catalogo de ferramentas do Chronos Local v2.7.2 — add list_cerebro (listar arquivos do Cerebro por diretorio)'
registry['updated_at'] = '2026-06-02'

with open(PATH, 'w', encoding='utf-8') as f:
    json.dump(registry, f, ensure_ascii=False, indent=2)

# Verificar
tools_ids = [t['id'] for t in registry['tools']]
print(f'OK — v{registry["version"]} | {len(tools_ids)} ferramentas')
print('Ordem:', ' > '.join(tools_ids))
print(f'Inserida em posicao {insert_at}: {new_tool["id"]}')
print(f'Keywords: {len(new_tool["trigger_keywords"])} triggers')
