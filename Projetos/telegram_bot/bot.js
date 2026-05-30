const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const net = require('net');
const https = require('https');

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const allowedChatId = parseInt(process.env.ALLOWED_CHAT_ID, 10);
const anthropicKey = process.env.ANTHROPIC_API_KEY || null;

if (!token || !allowedChatId) {
  console.error("ERRO CRÍTICO: TELEGRAM_BOT_TOKEN ou ALLOWED_CHAT_ID não definidos no .env");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';
const startTime = Date.now();

// ============================================================
// UTILITÁRIOS
// ============================================================

function getTodayDateString() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

function getTimeString() {
  return new Date().toTimeString().split(' ')[0];
}

// Garante que o chat é autorizado antes de processar qualquer comando
function isAuthorized(msg) {
  if (msg.chat.id !== allowedChatId) {
    console.warn(`[ALERTA DE SEGURANÇA] Acesso bloqueado do Chat ID: ${msg.chat.id}`);
    bot.sendMessage(msg.chat.id, "🔒 Acesso Negado: Dispositivo não autorizado pelo Gatekeeper.");
    return false;
  }
  return true;
}

// Verifica se uma porta local está aberta
function checkPort(port) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(1000);
    client.connect(port, '127.0.0.1', () => {
      client.destroy();
      resolve('🟢 ATIVO');
    });
    client.on('error', () => { client.destroy(); resolve('🔴 INATIVO'); });
    client.on('timeout', () => { client.destroy(); resolve('🟡 TIMEOUT'); });
  });
}

// Chama a API da Anthropic e retorna o texto da resposta
function askClaude(question) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: question }]
    });

    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.content && parsed.content[0] && parsed.content[0].text) {
            resolve(parsed.content[0].text);
          } else {
            reject(new Error('Resposta inesperada da API: ' + data));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ============================================================
// MIDDLEWARE DE SEGURANÇA GLOBAL
// ============================================================

bot.on('message', (msg) => {
  if (msg.chat.id !== allowedChatId) {
    console.warn(`[SEGURANÇA] Mensagem bloqueada do ID: ${msg.chat.id}`);
    bot.sendMessage(msg.chat.id, "🔒 Acesso Negado: Dispositivo não autorizado pelo Gatekeeper.");
  }
});

// ============================================================
// COMANDO: /start
// ============================================================

bot.onText(/^\/start$/, (msg) => {
  if (!isAuthorized(msg)) return;
  const menu = [
    '🤖 *Cérebro Edge AI — Chronos v3 Online*',
    '',
    '*Comandos disponíveis:*',
    '/tarefas — Mostra Backlog e Em Progresso do Kanban',
    '/tarefa [texto] — Adiciona nova tarefa ao Backlog',
    '/nota [texto] — Salva nota rápida no diário de hoje',
    '/noticias — Roda Tech Scraper PT/BR sob demanda',
    '/ia [pergunta] — Consulta o Claude diretamente',
    '/buscar [texto] — Busca semântica no Cérebro (RAG)',
    '/indexar — Reindexar o Cérebro para busca vetorial',
    '/backup — Envia um .tar.gz com todo o Cérebro',
    '/status — Status de todos os serviços do sistema'
  ].join('\n');
  bot.sendMessage(msg.chat.id, menu, { parse_mode: 'Markdown' });
});

// ============================================================
// COMANDO: /tarefas
// ============================================================

bot.onText(/^\/tarefas$/, (msg) => {
  if (!isAuthorized(msg)) return;
  try {
    const kanbanPath = path.join(WORKSPACE_ROOT, 'Cerebro', '03_Tarefas', 'kanban.md');
    if (!fs.existsSync(kanbanPath)) return bot.sendMessage(msg.chat.id, '❌ Kanban não encontrado.');

    const content = fs.readFileSync(kanbanPath, 'utf8');
    const lines = content.split('\n');
    const result = [];
    let capturing = false;

    for (const line of lines) {
      if (line.startsWith('## 🔨 Em Progresso') || line.startsWith('## 📋 Backlog')) {
        capturing = true;
        result.push(`*${line.replace('## ', '')}*`);
      } else if (line.startsWith('## ✅ Concluído')) {
        capturing = false;
      } else if (capturing && line.trim() !== '') {
        result.push(line);
      }
    }

    const text = result.join('\n') || 'Nenhuma tarefa pendente. 🎉';
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  } catch (e) {
    bot.sendMessage(msg.chat.id, '❌ Erro ao ler tarefas: ' + e.message);
  }
});

// ============================================================
// COMANDO: /tarefa [texto]
// Insere nova tarefa no Backlog do kanban.md
// ============================================================

bot.onText(/^\/tarefa (.+)/, (msg, match) => {
  if (!isAuthorized(msg)) return;
  const novaTarefa = match[1].trim();
  const kanbanPath = path.join(WORKSPACE_ROOT, 'Cerebro', '03_Tarefas', 'kanban.md');

  try {
    if (!fs.existsSync(kanbanPath)) {
      return bot.sendMessage(msg.chat.id, '❌ Kanban não encontrado.');
    }

    let content = fs.readFileSync(kanbanPath, 'utf8');
    const backlogMarker = '## 📋 Backlog';
    const backlogIndex = content.indexOf(backlogMarker);

    if (backlogIndex === -1) {
      return bot.sendMessage(msg.chat.id, '❌ Seção Backlog não encontrada no Kanban.');
    }

    // Insere a nova tarefa logo após o cabeçalho do Backlog
    const insertAt = backlogIndex + backlogMarker.length;
    const newEntry = `\n- [ ] ${novaTarefa} *(via Telegram — ${getTimeString()})*`;
    content = content.slice(0, insertAt) + newEntry + content.slice(insertAt);

    fs.writeFileSync(kanbanPath, content, 'utf8');
    console.log(`[KANBAN] Nova tarefa adicionada: ${novaTarefa}`);
    bot.sendMessage(msg.chat.id, `✅ Tarefa adicionada ao Backlog:\n_${novaTarefa}_`, { parse_mode: 'Markdown' });
  } catch (e) {
    bot.sendMessage(msg.chat.id, '❌ Erro ao escrever no Kanban: ' + e.message);
  }
});

// ============================================================
// COMANDO: /nota [texto]
// ============================================================

bot.onText(/^\/nota (.+)/, (msg, match) => {
  if (!isAuthorized(msg)) return;
  const noteContent = match[1];
  const dateStr = getTodayDateString();
  const timeStr = getTimeString();
  const diaryPath = path.join(WORKSPACE_ROOT, 'Cerebro', '04_Diario', `${dateStr}.md`);

  try {
    let fileContent = fs.existsSync(diaryPath)
      ? fs.readFileSync(diaryPath, 'utf8')
      : `# Diário de Bordo - ${dateStr}\n\n`;

    fileContent += `\n- [${timeStr}] (Telegram) ${noteContent}\n`;
    fs.writeFileSync(diaryPath, fileContent, 'utf8');
    bot.sendMessage(msg.chat.id, '✅ Nota salva no diário com sucesso!');
  } catch (e) {
    bot.sendMessage(msg.chat.id, '❌ Erro ao salvar nota: ' + e.message);
  }
});

// ============================================================
// COMANDO: /noticias
// ============================================================

bot.onText(/^\/noticias$/, (msg) => {
  if (!isAuthorized(msg)) return;
  bot.sendMessage(msg.chat.id, '🔄 Disparando Tech Scraper PT/BR...');

  const scriptPath = path.join(WORKSPACE_ROOT, 'Projetos', 'tech_scraper.py');
  exec(`python ${scriptPath}`, (error, stdout) => {
    if (error) return bot.sendMessage(msg.chat.id, '❌ Erro ao rodar scraper:\n' + error.message);

    const dateStr = getTodayDateString();
    const notePath = path.join(WORKSPACE_ROOT, 'Cerebro', '02_Memoria', `Tendencias_Tech_${dateStr}.md`);
    const reply = fs.existsSync(notePath)
      ? '✅ Scraper finalizado! Nota de tendências guardada no Cérebro.'
      : `✅ Scraper executado:\n\n${stdout}`;

    bot.sendMessage(msg.chat.id, reply);
  });
});

// ============================================================
// COMANDO: /ia [pergunta]
// Consulta o Claude Haiku e responde no Telegram
// ============================================================

bot.onText(/^\/ia (.+)/, async (msg, match) => {
  if (!isAuthorized(msg)) return;

  if (!anthropicKey) {
    return bot.sendMessage(msg.chat.id, '❌ ANTHROPIC_API_KEY não configurada no .env.\nAdicione a chave para usar este comando.');
  }

  const question = match[1].trim();
  bot.sendMessage(msg.chat.id, '🤔 Consultando o Claude...');

  try {
    const answer = await askClaude(question);
    // Telegram suporta até 4096 chars por mensagem
    if (answer.length > 4000) {
      await bot.sendMessage(msg.chat.id, answer.slice(0, 4000));
      await bot.sendMessage(msg.chat.id, '_(resposta truncada — excedeu 4000 caracteres)_', { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(msg.chat.id, answer);
    }
  } catch (e) {
    console.error('[IA ERROR]', e.message);
    bot.sendMessage(msg.chat.id, '❌ Erro ao consultar a IA:\n' + e.message);
  }
});

// ============================================================
// COMANDO: /indexar  — RAG SOBERANO
// Força a reindexação do Cérebro para busca vetorial
// ============================================================

bot.onText(/^\/indexar$/, async (msg) => {
  if (!isAuthorized(msg)) return;

  bot.sendMessage(msg.chat.id, '🧠 Iniciando indexação vetorial do Cérebro... Isso pode levar alguns minutos na primeira vez.');

  try {
    // Import dinâmico do módulo ESM a partir do bot CommonJS
    const vectorDb = await import(path.join(WORKSPACE_ROOT, 'Scripts', 'core', 'vector_db.js'));
    const stats = await vectorDb.indexCerebro();

    const reply = [
      '✅ *Indexação do Cérebro concluída!*',
      '',
      `📄 Arquivos indexados: ${stats.totalFiles}`,
      `🧩 Chunks gerados: ${stats.totalChunks}`,
      `⏱ Tempo: ${stats.elapsedSeconds}s`,
    ].join('\n');

    bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' }).catch(err => console.error('Erro envio Telegram:', err.message));
  } catch (e) {
    console.error('[INDEXAR ERROR]', e.message);
    bot.sendMessage(msg.chat.id, '❌ Erro na indexação:\n' + e.message);
  }
});

// ============================================================
// COMANDO: /buscar [texto]  — RAG SOBERANO
// Busca semântica no Cérebro indexado
// ============================================================

bot.onText(/^\/buscar (.+)/, async (msg, match) => {
  if (!isAuthorized(msg)) return;
  const query = match[1].trim();

  bot.sendMessage(msg.chat.id, `🔍 Buscando no Cérebro: _"${query}"_...`, { parse_mode: 'Markdown' });

  try {
    const vectorDb = await import(path.join(WORKSPACE_ROOT, 'Scripts', 'core', 'vector_db.js'));
    const result = await vectorDb.search(query, 5);

    if (!result.success) {
      return bot.sendMessage(msg.chat.id, '❌ ' + result.error);
    }

    if (result.results.length === 0) {
      return bot.sendMessage(msg.chat.id, '😶 Nenhum resultado encontrado para essa busca.');
    }

    const lines = ['🧠 *Resultados da Busca Semântica:*', ''];
    for (let i = 0; i < result.results.length; i++) {
      const r = result.results[i];
      lines.push(`*${i + 1}. ${r.file}* (${r.relevance})`);
      // Limita o trecho para o Telegram não ficar gigante
      const excerpt = r.excerpt.replace(/[_*\[\]()~`>#+=|{}.!-]/g, '').substring(0, 200);
      lines.push(`"${excerpt}..."`);
      lines.push('');
    }

    const reply = lines.join('\n');
    if (reply.length > 4000) {
      bot.sendMessage(msg.chat.id, reply.slice(0, 4000), { parse_mode: 'Markdown' });
    } else {
      bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' }).catch(err => console.error('Erro envio Telegram:', err.message));
    }
  } catch (e) {
    console.error('[BUSCAR ERROR]', e.message);
    bot.sendMessage(msg.chat.id, '❌ Erro na busca semântica:\n' + e.message);
  }
});

// ============================================================
// COMANDO: /status
// Verifica MCP (3001), API REST (4000) e uptime do bot
// ============================================================

bot.onText(/^\/status$/, async (msg) => {
  if (!isAuthorized(msg)) return;

  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);

  const [mcpStatus, apiStatus] = await Promise.all([
    checkPort(3001),
    checkPort(4000)
  ]);

  const iaStatus = anthropicKey ? '🟢 API KEY configurada' : '🔴 API KEY ausente';
  const cachePath = path.join(WORKSPACE_ROOT, 'Cerebro', '.vector_cache.json');
  const ragStatus = fs.existsSync(cachePath) ? '🟢 Índice ativo' : '🔴 Não indexado (rode /indexar)';

  const statusMsg = [
    '⚙️ *Status do Sistema — Chronos v3*',
    '',
    `🤖 *Bot Uptime:* ${hours}h ${minutes}m`,
    `📡 *MCP Server (3001):* ${mcpStatus}`,
    `🌐 *API REST (4000):* ${apiStatus}`,
    `🧠 *Claude /ia:* ${iaStatus}`,
    `🔍 *RAG Soberano:* ${ragStatus}`,
  ].join('\n');

  bot.sendMessage(msg.chat.id, statusMsg, { parse_mode: 'Markdown' });
});

// ============================================================
// COMANDO: /backup
// Compacta a pasta Cerebro e envia o .tar.gz pelo Telegram
// ============================================================

bot.onText(/^\/backup$/, (msg) => {
  if (!isAuthorized(msg)) return;
  
  bot.sendMessage(msg.chat.id, '📦 Iniciando compactação segura do Cérebro, aguarde...');
  
  const dateStr = getTodayDateString();
  const timeStr = getTimeString().replace(/:/g, '-');
  const backupFileName = `Cerebro_Backup_${dateStr}_${timeStr}.tar.gz`;
  const backupFilePath = path.join(WORKSPACE_ROOT, backupFileName);
  
  // Usamos tar porque é nativo em ambientes Unix/Termux e muito rápido
  const tarCommand = `tar -czf ${backupFilePath} -C ${WORKSPACE_ROOT} Cerebro`;
  
  exec(tarCommand, async (error) => {
    if (error) {
      return bot.sendMessage(msg.chat.id, '❌ Erro ao criar backup:\n' + error.message);
    }
    
    try {
      await bot.sendMessage(msg.chat.id, '✅ Cérebro compactado! Fazendo upload do pacote via Telegram...');
      await bot.sendDocument(msg.chat.id, backupFilePath, {
        caption: `🛡️ Backup de Segurança do Cérebro\nGerado em: ${dateStr} às ${getTimeString()}`
      });
      
      // Limpeza do arquivo local após o envio para não acumular lixo no Android
      if (fs.existsSync(backupFilePath)) {
        fs.unlinkSync(backupFilePath);
      }
    } catch (sendError) {
      console.error('[BACKUP ERROR]', sendError.message);
      bot.sendMessage(msg.chat.id, '❌ Erro ao enviar o arquivo pelo Telegram:\n' + sendError.message);
    }
  });
});

console.log('✅ Chronos v3 (com RAG Soberano) iniciado e aguardando comandos...');
