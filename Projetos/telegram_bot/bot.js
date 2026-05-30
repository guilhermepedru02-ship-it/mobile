const TelegramBot = require('node-telegram-bot-api');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const net = require('net');
const http = require('http');
const https = require('https');

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
const allowedChatId = parseInt(process.env.ALLOWED_CHAT_ID, 10);
const anthropicKey = process.env.ANTHROPIC_API_KEY || null;

if (!token || !allowedChatId) {
  console.error('ERRO CRÍTICO: TELEGRAM_BOT_TOKEN ou ALLOWED_CHAT_ID não definidos no .env');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });
const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';
const startTime = Date.now();

// ============================================================
// UTILITÁRIOS
// ============================================================

function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

function getTimeString() {
  return new Date().toTimeString().split(' ')[0];
}

function isAuthorized(msg) {
  if (msg.chat.id !== allowedChatId) {
    console.warn(`[ALERTA DE SEGURANÇA] Acesso bloqueado do Chat ID: ${msg.chat.id}`);
    bot.sendMessage(msg.chat.id, '\uD83D\uDD12 Acesso Negado: Dispositivo não autorizado pelo Gatekeeper.');
    return false;
  }
  return true;
}

function checkPort(port) {
  return new Promise((resolve) => {
    const client = new net.Socket();
    client.setTimeout(1000);
    client.connect(port, '127.0.0.1', () => { client.destroy(); resolve('\uD83D\uDFE2 ATIVO'); });
    client.on('error', () => { client.destroy(); resolve('\uD83D\uDD34 INATIVO'); });
    client.on('timeout', () => { client.destroy(); resolve('\uD83D\uDFE1 TIMEOUT'); });
  });
}

// ============================================================
// IA EXTERNA — Claude (Anthropic API)
// ============================================================

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
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// ============================================================
// IA LOCAL — Agente Ollama (porta 4001)
// ============================================================

function callLocalAgent(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ prompt });
    const options = {
      hostname: '127.0.0.1',
      port: 4001,
      path: '/agent',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Resposta inválida do agente local.')); }
      });
    });
    req.setTimeout(58000, () => { req.destroy(); reject(new Error('timeout')); });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Fallback inteligente: tenta agente local, cai no Claude se necessário
async function askWithFallback(chatId, prompt) {
  try {
    const result = await callLocalAgent(prompt);
    if (result.success && !result.fallback) {
      const toolTag = result.tool ? `\n\n\uD83D\uDD27 _Ferramenta: ${result.tool}_` : '';
      const reply = (result.response || 'Sem resposta.') + toolTag;
      const chunks = reply.match(/.{1,4000}/gs) || [reply];
      for (const chunk of chunks) {
        await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' }).catch(() =>
          bot.sendMessage(chatId, chunk)
        );
      }
      return;
    }
    // Agente retornou fallback explicitamente (Ollama offline)
    throw new Error(result.error || 'fallback solicitado pelo agente');
  } catch (err) {
    console.warn(`[LOCAL FALLBACK] ${err.message}`);
    await bot.sendMessage(chatId, '\u26A0\uFE0F IA local indisponível. Redirecionando para Claude...');
    if (!anthropicKey) {
      return bot.sendMessage(chatId, '\u274C Claude também indisponível (API KEY ausente).');
    }
    try {
      const answer = await askClaude(prompt);
      const header = '_\u2728 (via Claude \u2014 fallback automático)_\n\n';
      const full = header + answer;
      const chunks = full.match(/.{1,4000}/gs) || [full];
      for (const chunk of chunks) {
        await bot.sendMessage(chatId, chunk, { parse_mode: 'Markdown' }).catch(() =>
          bot.sendMessage(chatId, chunk)
        );
      }
    } catch (e2) {
      bot.sendMessage(chatId, '\u274C Todos os canais de IA indisponíveis. Tente novamente mais tarde.');
    }
  }
}

// ============================================================
// MIDDLEWARE DE SEGURANÇA GLOBAL
// ============================================================

bot.on('message', (msg) => {
  if (msg.chat.id !== allowedChatId) {
    console.warn(`[SEGURANÇA] Mensagem bloqueada do ID: ${msg.chat.id}`);
    bot.sendMessage(msg.chat.id, '\uD83D\uDD12 Acesso Negado: Dispositivo não autorizado pelo Gatekeeper.');
  }
});

// ============================================================
// COMANDO: /start
// ============================================================

bot.onText(/^\/start$/, (msg) => {
  if (!isAuthorized(msg)) return;
  const menu = [
    '\uD83E\uDDE0 *Cérebro Edge AI \u2014 Chronos v4 Online*',
    '',
    '*Comandos disponíveis:*',
    '/tarefas \u2014 Mostra Backlog e Em Progresso do Kanban',
    '/tarefa [texto] \u2014 Adiciona nova tarefa ao Backlog',
    '/nota [texto] \u2014 Salva nota rápida no diário de hoje',
    '/noticias \u2014 Roda Tech Scraper PT/BR sob demanda',
    '/local [prompt] \u2014 Consulta a IA local offline (Ollama)',
    '/ia [pergunta] \u2014 Consulta o Claude diretamente',
    '/buscar [texto] \u2014 Busca semântica no Cérebro (RAG)',
    '/indexar \u2014 Reindexar o Cérebro para busca vetorial',
    '/backup \u2014 Envia .tar.gz com todo o Cérebro',
    '/status \u2014 Status de todos os serviços do sistema'
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
    if (!fs.existsSync(kanbanPath)) return bot.sendMessage(msg.chat.id, '\u274C Kanban não encontrado.');
    const content = fs.readFileSync(kanbanPath, 'utf8');
    const lines = content.split('\n');
    const result = [];
    let capturing = false;
    for (const line of lines) {
      if (line.startsWith('## \uD83D\uDD28 Em Progresso') || line.startsWith('## \uD83D\uDCCB Backlog')) {
        capturing = true;
        result.push(`*${line.replace('## ', '')}*`);
      } else if (line.startsWith('## \u2705 Concluído')) {
        capturing = false;
      } else if (capturing && line.trim() !== '') {
        result.push(line);
      }
    }
    const text = result.join('\n') || 'Nenhuma tarefa pendente. \uD83C\uDF89';
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'Markdown' });
  } catch (e) {
    bot.sendMessage(msg.chat.id, '\u274C Erro ao ler tarefas: ' + e.message);
  }
});

// ============================================================
// COMANDO: /tarefa [texto]
// ============================================================

bot.onText(/^\/tarefa (.+)/, (msg, match) => {
  if (!isAuthorized(msg)) return;
  const novaTarefa = match[1].trim();
  const kanbanPath = path.join(WORKSPACE_ROOT, 'Cerebro', '03_Tarefas', 'kanban.md');
  try {
    if (!fs.existsSync(kanbanPath)) return bot.sendMessage(msg.chat.id, '\u274C Kanban não encontrado.');
    let content = fs.readFileSync(kanbanPath, 'utf8');
    const backlogMarker = '## \uD83D\uDCCB Backlog';
    const backlogIndex = content.indexOf(backlogMarker);
    if (backlogIndex === -1) return bot.sendMessage(msg.chat.id, '\u274C Seção Backlog não encontrada no Kanban.');
    const insertAt = backlogIndex + backlogMarker.length;
    const newEntry = `\n- [ ] ${novaTarefa} *(via Telegram \u2014 ${getTimeString()})*`;
    content = content.slice(0, insertAt) + newEntry + content.slice(insertAt);
    fs.writeFileSync(kanbanPath, content, 'utf8');
    bot.sendMessage(msg.chat.id, `\u2705 Tarefa adicionada ao Backlog:\n_${novaTarefa}_`, { parse_mode: 'Markdown' });
  } catch (e) {
    bot.sendMessage(msg.chat.id, '\u274C Erro ao escrever no Kanban: ' + e.message);
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
    bot.sendMessage(msg.chat.id, '\u2705 Nota salva no diário com sucesso!');
  } catch (e) {
    bot.sendMessage(msg.chat.id, '\u274C Erro ao salvar nota: ' + e.message);
  }
});

// ============================================================
// COMANDO: /noticias
// ============================================================

bot.onText(/^\/noticias$/, (msg) => {
  if (!isAuthorized(msg)) return;
  bot.sendMessage(msg.chat.id, '\uD83D\uDD04 Disparando Tech Scraper PT/BR...');
  const scriptPath = path.join(WORKSPACE_ROOT, 'Projetos', 'tech_scraper.py');
  exec(`python ${scriptPath}`, (error, stdout) => {
    if (error) return bot.sendMessage(msg.chat.id, '\u274C Erro ao rodar scraper:\n' + error.message);
    const dateStr = getTodayDateString();
    const notePath = path.join(WORKSPACE_ROOT, 'Cerebro', '02_Memoria', `Tendencias_Tech_${dateStr}.md`);
    const reply = fs.existsSync(notePath)
      ? '\u2705 Scraper finalizado! Nota de tendências guardada no Cérebro.'
      : `\u2705 Scraper executado:\n\n${stdout}`;
    bot.sendMessage(msg.chat.id, reply);
  });
});

// ============================================================
// COMANDO: /local [prompt] — IA LOCAL COM FALLBACK
// ============================================================

bot.onText(/^\/local (.+)/, async (msg, match) => {
  if (!isAuthorized(msg)) return;
  const prompt = match[1].trim();
  bot.sendMessage(msg.chat.id, '\uD83E\uDDE0 Consultando IA local...');
  await askWithFallback(msg.chat.id, prompt);
});

// ============================================================
// COMANDO: /ia [pergunta] — CLAUDE DIRETO
// ============================================================

bot.onText(/^\/ia (.+)/, async (msg, match) => {
  if (!isAuthorized(msg)) return;
  if (!anthropicKey) {
    return bot.sendMessage(msg.chat.id, '\u274C ANTHROPIC_API_KEY não configurada no .env.');
  }
  const question = match[1].trim();
  bot.sendMessage(msg.chat.id, '\uD83E\uDD14 Consultando o Claude...');
  try {
    const answer = await askClaude(question);
    const chunks = answer.match(/.{1,4000}/gs) || [answer];
    for (const chunk of chunks) {
      await bot.sendMessage(msg.chat.id, chunk).catch(() => bot.sendMessage(msg.chat.id, chunk));
    }
  } catch (e) {
    console.error('[IA ERROR]', e.message);
    bot.sendMessage(msg.chat.id, '\u274C Erro ao consultar a IA:\n' + e.message);
  }
});

// ============================================================
// COMANDO: /indexar — RAG SOBERANO
// ============================================================

bot.onText(/^\/indexar$/, async (msg) => {
  if (!isAuthorized(msg)) return;
  bot.sendMessage(msg.chat.id, '\uD83E\uDDE0 Iniciando indexação vetorial do Cérebro...');
  try {
    const vectorDb = await import(path.join(WORKSPACE_ROOT, 'Scripts', 'core', 'vector_db.js'));
    const stats = await vectorDb.indexCerebro();
    const reply = [
      '\u2705 *Indexação do Cérebro concluída!*', '',
      `\uD83D\uDCC4 Arquivos indexados: ${stats.totalFiles}`,
      `\uD83E\uDDE9 Chunks gerados: ${stats.totalChunks}`,
      `\u23F1 Tempo: ${stats.elapsedSeconds}s`
    ].join('\n');
    bot.sendMessage(msg.chat.id, reply, { parse_mode: 'Markdown' }).catch(e => console.error(e.message));
  } catch (e) {
    console.error('[INDEXAR ERROR]', e.message);
    bot.sendMessage(msg.chat.id, '\u274C Erro na indexação:\n' + e.message);
  }
});

// ============================================================
// COMANDO: /buscar [texto] — RAG SOBERANO
// ============================================================

bot.onText(/^\/buscar (.+)/, async (msg, match) => {
  if (!isAuthorized(msg)) return;
  const query = match[1].trim();
  bot.sendMessage(msg.chat.id, `\uD83D\uDD0D Buscando no Cérebro: _"${query}"_...`, { parse_mode: 'Markdown' });
  try {
    const vectorDb = await import(path.join(WORKSPACE_ROOT, 'Scripts', 'core', 'vector_db.js'));
    const result = await vectorDb.search(query, 5);
    if (!result.success) return bot.sendMessage(msg.chat.id, '\u274C ' + result.error);
    if (result.results.length === 0) return bot.sendMessage(msg.chat.id, '\uD83D\uDE36 Nenhum resultado encontrado.');
    const lines = ['\uD83E\uDDE0 *Resultados da Busca Semântica:*', ''];
    for (let i = 0; i < result.results.length; i++) {
      const r = result.results[i];
      lines.push(`*${i + 1}. ${r.file}* (${r.relevance})`);
      const excerpt = r.excerpt.replace(/[_*\[\]()~`>#+=|{}.!-]/g, '').substring(0, 200);
      lines.push(`"${excerpt}..."`);
      lines.push('');
    }
    const reply = lines.join('\n');
    const safe = reply.length > 4000 ? reply.slice(0, 4000) : reply;
    bot.sendMessage(msg.chat.id, safe, { parse_mode: 'Markdown' }).catch(e => console.error(e.message));
  } catch (e) {
    console.error('[BUSCAR ERROR]', e.message);
    bot.sendMessage(msg.chat.id, '\u274C Erro na busca semântica:\n' + e.message);
  }
});

// ============================================================
// COMANDO: /status — TODOS OS SERVIÇOS
// ============================================================

bot.onText(/^\/status$/, async (msg) => {
  if (!isAuthorized(msg)) return;
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const [mcpStatus, apiStatus, agentStatus, ollamaStatus] = await Promise.all([
    checkPort(3001),
    checkPort(4000),
    checkPort(4001),
    checkPort(11434)
  ]);
  const iaStatus = anthropicKey ? '\uD83D\uDFE2 API KEY configurada' : '\uD83D\uDD34 API KEY ausente';
  const cachePath = path.join(WORKSPACE_ROOT, 'Cerebro', '.vector_cache.json');
  const ragStatus = fs.existsSync(cachePath) ? '\uD83D\uDFE2 Índice ativo' : '\uD83D\uDD34 Não indexado (/indexar)';
  const statusMsg = [
    '\u2699\uFE0F *Status do Sistema \u2014 Chronos v4*', '',
    `\uD83E\uDDE0 *Bot Uptime:* ${hours}h ${minutes}m`,
    `\uD83D\uDCE1 *MCP Server (3001):* ${mcpStatus}`,
    `\uD83C\uDF10 *API REST (4000):* ${apiStatus}`,
    `\uD83E\uDD16 *Agente Local (4001):* ${agentStatus}`,
    `\uD83E\uDD99 *Ollama LLM (11434):* ${ollamaStatus}`,
    `\uD83E\uDDE0 *Claude /ia:* ${iaStatus}`,
    `\uD83D\uDD0D *RAG Soberano:* ${ragStatus}`
  ].join('\n');
  bot.sendMessage(msg.chat.id, statusMsg, { parse_mode: 'Markdown' });
});

// ============================================================
// COMANDO: /backup
// ============================================================

bot.onText(/^\/backup$/, (msg) => {
  if (!isAuthorized(msg)) return;
  bot.sendMessage(msg.chat.id, '\uD83D\uDCE6 Iniciando compactação segura do Cérebro, aguarde...');
  const dateStr = getTodayDateString();
  const timeStr = getTimeString().replace(/:/g, '-');
  const backupFileName = `Cerebro_Backup_${dateStr}_${timeStr}.tar.gz`;
  const backupFilePath = path.join(WORKSPACE_ROOT, backupFileName);
  const tarCommand = `tar -czf ${backupFilePath} -C ${WORKSPACE_ROOT} Cerebro`;
  exec(tarCommand, async (error) => {
    if (error) return bot.sendMessage(msg.chat.id, '\u274C Erro ao criar backup:\n' + error.message);
    try {
      await bot.sendMessage(msg.chat.id, '\u2705 Cérebro compactado! Fazendo upload...');
      await bot.sendDocument(msg.chat.id, backupFilePath, {
        caption: `\uD83D\uDEE1\uFE0F Backup de Segurança do Cérebro\nGerado em: ${dateStr} às ${getTimeString()}`
      });
      if (fs.existsSync(backupFilePath)) fs.unlinkSync(backupFilePath);
    } catch (sendError) {
      console.error('[BACKUP ERROR]', sendError.message);
      bot.sendMessage(msg.chat.id, '\u274C Erro ao enviar o arquivo:\n' + sendError.message);
    }
  });
});

console.log('\u2705 Chronos v4 (IA Local + RAG Soberano + Fallback Inteligente) iniciado.');
