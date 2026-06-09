import json
import os
from pathlib import Path
from datetime import datetime

RAG_DIR = Path('/storage/emulated/0/Workspace/Cerebro/Memoria-RAG')
CORE_DIR = Path('/storage/emulated/0/Workspace/Scripts/core')

# 1. Consolida todos os wm_*.json de hoje em um unico resumo diario
today = datetime.now().strftime('%Y-%m-%d')
wm_files = sorted(RAG_DIR.glob(f'{today}_wm_*.json'))

entries = []
for f in wm_files:
    try:
        data = json.loads(f.read_text(encoding='utf-8'))
        entries.append(data)
    except Exception as e:
        print(f'Skip {f.name}: {e}')

if entries:
    summary = {
        'date': today,
        'type': 'daily_consolidation',
        'source': 'wm_cleanup_script',
        'total_tasks': len(entries),
        'tasks': entries
    }
    out = RAG_DIR / f'{today}_consolidated.json'
    out.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'Consolidado: {len(entries)} arquivos -> {out.name}')

    # Remove os fragmentos originais
    for f in wm_files:
        f.unlink()
    print(f'Removidos: {len(wm_files)} arquivos wm_*.json')
else:
    print('Nenhum wm_*.json encontrado para hoje')

# 2. Remove arquivos temporarios de patch e logs de desenvolvimento
temp_files = [
    'context_builder.js.bak',
    'dispatch.js.bak',
    'ollama_agent.js.bak',
    'nohup.out',
    'nohup_new.out',
    'nohup_v3.out',
    'patch_agent.mjs',
    'patch_agent_v2.mjs',
    'patch_gemini_bridge.py',
    'patch_hallucination.py',
    'patch_identity_bypass.py',
    'patch_ollama_agent.py',
    'patch_quality_heuristic.py',
    'identity_report.py',
]

removed = []
for name in temp_files:
    p = CORE_DIR / name
    if p.exists():
        p.unlink()
        removed.append(name)

print(f'Removidos {len(removed)} arquivos temporarios: {removed}')
print('Limpeza concluida.')
