const fs = require('fs');
const kanbanPath = '/storage/emulated/0/Workspace/Cerebro/03_Tarefas/kanban.md';
let content = fs.readFileSync(kanbanPath, 'utf8');

// Adiciona a tarefa RAG Soberano no final
content += '\n- [x] Implementar Busca Vetorial Local (RAG Soberano via MiniSearch) com comandos /indexar e /buscar no Telegram';

fs.writeFileSync(kanbanPath, content, 'utf8');
console.log('Kanban atualizado!');
