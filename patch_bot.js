const fs = require('fs');
const botPath = '/storage/emulated/0/Workspace/Projetos/telegram_bot/bot.js';
let content = fs.readFileSync(botPath, 'utf8');

// Substituir a parte que envia a mensagem e escapa o markdown
content = content.replace(
  /const excerpt = r\.excerpt\.replace\(\/\[_\*\\\[\\\]\(\)~`>#\+=\|\{\}\.\!-\]\/g, '\\\\\$&'\)\.substring\(0, 200\);/,
  "const excerpt = r.excerpt.replace(/[_*\\[\\]()~`>#+=|{}.!-]/g, '').substring(0, 200);"
);

// Remover _ do início e fim do excerpt
content = content.replace(
  /lines\.push\(`_\$\{excerpt\}_`\);/g,
  "lines.push(`\"${excerpt}...\"`);"
);

// Garantir que os bot.sendMessage tenham await e catch para não dar crash silencioso
content = content.replace(
  /bot\.sendMessage\(msg\.chat\.id, reply, \{ parse_mode: 'Markdown' \}\);/g,
  "bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' }).catch(err => console.error('Erro envio Telegram:', err.message));"
);

fs.writeFileSync(botPath, content, 'utf8');
console.log('Patch aplicado com sucesso!');
