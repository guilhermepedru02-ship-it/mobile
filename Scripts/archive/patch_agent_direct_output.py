import re

PATH = '/storage/emulated/0/Workspace/Scripts/core/ollama_agent.js'

with open(PATH, 'r', encoding='utf-8') as f:
    code = f.read()

OLD = "'identity_check', 'list_tools', 'ram_status', 'disk_usage', 'git_status', 'git_log',\n                'services_health', 'self_health_check', 'llm_status', 'workspace_agent_status',\n                'cloud_usage', 'kanban_read', 'diary_today'"

NEW = "'identity_check', 'list_tools', 'list_cerebro', 'ram_status', 'disk_usage', 'git_status', 'git_log',\n                'services_health', 'self_health_check', 'llm_status', 'workspace_agent_status',\n                'cloud_usage', 'kanban_read', 'diary_today'"

OLD2 = "'identity_check', 'list_tools', 'ram_status', 'disk_usage', 'git_status', 'git_log',\n        'services_health', 'self_health_check', 'llm_status', 'workspace_agent_status',\n        'cloud_usage', 'kanban_read', 'diary_today'"

NEW2 = "'identity_check', 'list_tools', 'list_cerebro', 'ram_status', 'disk_usage', 'git_status', 'git_log',\n        'services_health', 'self_health_check', 'llm_status', 'workspace_agent_status',\n        'cloud_usage', 'kanban_read', 'diary_today'"

if OLD in code:
    code = code.replace(OLD, NEW, 1)
    print('Patch 1 (DIRECT_OUTPUT inline): OK')
else:
    print('AVISO: Patch 1 nao encontrado — texto diferente do esperado')

if OLD2 in code:
    code = code.replace(OLD2, NEW2, 1)
    print('Patch 2 (DIRECT_OUTPUT bypass): OK')
else:
    print('AVISO: Patch 2 nao encontrado — texto diferente do esperado')

with open(PATH, 'w', encoding='utf-8') as f:
    f.write(code)

count = code.count("'list_cerebro'")
print(f'Verificacao: list_cerebro aparece {count}x no arquivo (esperado: 2)')
