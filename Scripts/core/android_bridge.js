/**
 * android_bridge.js — Android Bridge Gateway
 * FASE 6.1 — Ponte segura entre IAs externas e o Android
 * Versão: 2.0.0 | TTS Queue System v2 | 2026-06-09
 *
 * Porta: 4444 (apenas localhost — 127.0.0.1)
 * Dependência: pkg install termux-api + app Termux:API instalado
 *
 * REGRA INVIOLÁVEL: Segurança → Implementação → Teste → Documentação
 */

import express from 'express';
import { exec, spawn } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { bridgeAuth, getRateLimitStatus } from './bridge_middleware.js';
import { logAudit, getAuditLog, getAuditStats } from './bridge_audit.js';

// Cleanup TTS orphans de sessoes anteriores (anti-signal9 residual)
exec("kill $(ps aux | grep 'termux-tts-speak' | grep -v grep | awk '{print $2}') 2>/dev/null || true",
  (err, stdout, stderr) => { console.log('[Bridge] Cleanup TTS orphans na inicializacao'); }
);

// Cleanup periodico de TTS zumbis a cada 60s (previne acumulo durante sessao)
// Cleanup TTS zumbis a cada 20s -- threshold >1 previne acumulo (load alto / signal9)
setInterval(() => {
  exec("pgrep -fc 'termux-tts-speak' 2>/dev/null || echo 0", (e, out) => {
    const count = parseInt(out.trim(), 10) || 0;
    if (count > 1) {
      exec("pkill -f 'termux-tts-speak' 2>/dev/null; pkill -f 'TextToSpeech' 2>/dev/null; true", () => {
        console.log(`[Bridge] Cleanup TTS: ${count} zumbis eliminados`);
        if (ttsState.playing) {
          ttsState.playing = false;
          ttsState.proc = null;
          if (ttsQueue.length > 0) setImmediate(processTtsQueue);
        }
      });
    }
  });
}, 20_000);

dotenv.config({ path: '/storage/emulated/0/Workspace/Scripts/core/.env' });

const app = express();
app.use(express.json());

const BRIDGE_OWNER_KEY = process.env.BRIDGE_OWNER_KEY;
const PORT = 4444;

// =============================================================================
// HELPER: Executa comando termux-api com timeout de 10s
// =============================================================================
function runTermuxCommand(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 10_000 }, (err, stdout, stderr) => {
      if (err) {
        const msg = stderr?.trim() || err.message;
        return reject(new Error(msg));
      }
      const output = stdout.trim();
      // Tenta JSON primeiro, retorna objeto raw se falhar
      try {
        resolve(JSON.parse(output));
      } catch {
        resolve({ raw: output });
      }
    });
  });
}


// =============================================================================
// TTS QUEUE SYSTEM v2.0 — Async, nao-bloqueante, multi-IA
// Problema original: termux-tts-speak bloqueava runTermuxCommand (timeout 10s).
// Solucao: fila FIFO + spawn + resposta HTTP imediata.
// =============================================================================
const ttsQueue = [];          // { text, ia, ts, segments }
const TTS_MAX_QUEUE   = 10;   // max itens na fila (anti-spam)
const TTS_MAX_SEGMENT = 200;  // chars por segmento — ~13-16s de fala natural
const ttsState = {
  playing:     false,
  currentIA:   null,
  currentText: null,
  proc:        null,   // processo spawn ativo
  totalSpoken: 0       // contador acumulado de segmentos
};

/**
 * Divide texto em segmentos de no maximo TTS_MAX_SEGMENT chars,
 * quebrando em pontuacao natural para fala fluente.
 */
function segmentText(text) {
  if (text.length <= TTS_MAX_SEGMENT) return [text];
  const segments = [];
  const delimiters = ['. ', '! ', '? ', ': ', '; ', ' — ', ', '];
  let remaining = text.trim();
  while (remaining.length > TTS_MAX_SEGMENT) {
    let splitAt = -1;
    for (const delim of delimiters) {
      const idx = remaining.lastIndexOf(delim, TTS_MAX_SEGMENT);
      if (idx >= 15) { splitAt = idx + delim.length; break; }
    }
    if (splitAt === -1) {
      const spaceIdx = remaining.lastIndexOf(' ', TTS_MAX_SEGMENT);
      splitAt = spaceIdx > 0 ? spaceIdx + 1 : TTS_MAX_SEGMENT;
    }
    segments.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) segments.push(remaining);
  return segments.filter(s => s.length > 0);
}

/**
 * Processa a fila TTS de forma sequencial e assincrona.
 * Cada segmento e falado via spawn (nao bloqueia o event loop).
 * Chama-se via setImmediate enquanto houver itens.
 */
async function processTtsQueue() {
  if (ttsState.playing || ttsQueue.length === 0) return;
  const item = ttsQueue.shift();
  const segments = segmentText(item.text);
  ttsState.playing   = true;
  ttsState.currentIA = item.ia;
  for (const seg of segments) {
    if (!ttsState.playing) break; // cancelamento durante reproducao
    ttsState.currentText = seg;
    await new Promise((resolve) => {
      const safeText = seg.replace(/"/g, "''").replace(/\n/g, ' ');
      const proc = spawn('termux-tts-speak', [safeText], { stdio: 'ignore', detached: false });
      ttsState.proc = proc;
      // Timeout dinamico: ~130wpm, 5 chars/palavra + 4s buffer (anti-zumbi)
      const _wTimeout = Math.ceil((safeText.length / 650) * 60_000) + 4_000;
      const safetyTimer = setTimeout(() => {
        try { proc.kill('SIGTERM'); } catch (_) {}
        resolve();
      }, _wTimeout);
      proc.on('close', () => { clearTimeout(safetyTimer); resolve(); });
      proc.on('error', () => { clearTimeout(safetyTimer); resolve(); });
    });
    ttsState.totalSpoken++;
  }
  ttsState.playing     = false;
  ttsState.currentIA   = null;
  ttsState.currentText = null;
  ttsState.proc        = null;
  if (ttsQueue.length > 0) setImmediate(processTtsQueue);
}

// =============================================================================
// CAMADA 1: ROTAS READ — implementadas primeiro, validadas antes das WRITE
// =============================================================================

/**
 * POST /bridge/battery
 * Retorna nível, status e temperatura da bateria.
 * Escopo: read:battery
 */
app.post('/bridge/battery', bridgeAuth('read:battery'), async (req, res) => {
  const ia = req.bridgeIdentity.name;
  try {
    const data = await runTermuxCommand('termux-battery-status');
    logAudit({ ia, scope: 'read:battery', operation: 'termux-battery-status', status: 'OK' });
    res.json({ success: true, data });
  } catch (err) {
    logAudit({ ia, scope: 'read:battery', operation: 'termux-battery-status', status: 'ERROR', reason: err.message });
    res.status(500).json({ success: false, error: err.message, hint: 'termux-api instalado? App Termux:API ativo?' });
  }
});

/**
 * POST /bridge/wifi
 * Retorna SSID, força do sinal e IP da rede Wi-Fi atual.
 * Escopo: read:wifi
 */
app.post('/bridge/wifi', bridgeAuth('read:wifi'), async (req, res) => {
  const ia = req.bridgeIdentity.name;
  const CACHE_FILE = '/sdcard/Workspace/Logs/wifi_ssid_cache.json';
  try {
    const data = await runTermuxCommand('termux-wifi-connectioninfo');
    // Android 10+ bloqueia SSID em background (bssid=02:00:00:00:00:00, network_id=-1)
    const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutos
    const isBlocked = !data.ssid || data.ssid === '<unknown ssid>';
    if (!isBlocked) {
      // SSID real disponivel — salva cache fresco
      const { writeFileSync } = await import('fs');
      writeFileSync(CACHE_FILE, JSON.stringify({ ssid: data.ssid, ts: Date.now() }));
    } else {
      // Android bloqueou SSID — tenta cache recente (max 30min)
      try {
        const { readFileSync } = await import('fs');
        const cached = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
        const cacheAgeMin = Math.round((Date.now() - cached.ts) / 60000);
        if (cached.ssid && (Date.now() - cached.ts) < CACHE_TTL_MS) {
          data.ssid = cached.ssid;
          data.ssid_source = `cache_${cacheAgeMin}min`;
        } else {
          // Cache expirado ou ausente — reporta honestamente
          data.ssid = null;
          data.ssid_source = 'android_blocked' ;
          data.ssid_hint = 'Ative localizacao no Android para ler SSID em background';
        }
      } catch (_) {
        data.ssid = null;
        data.ssid_source = 'android_blocked';
        data.ssid_hint = 'Ative localizacao no Android para ler SSID em background';
      }
    }
    logAudit({ ia, scope: 'read:wifi', operation: 'termux-wifi-connectioninfo', status: 'OK' });
    res.json({ success: true, data });
  } catch (err) {
    logAudit({ ia, scope: 'read:wifi', operation: 'termux-wifi-connectioninfo', status: 'ERROR', reason: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /bridge/location
 * Retorna lat, long e precisão GPS.
 * Escopo: read:location
 * Body opcional: { provider: "gps" | "network" | "passive" }
 */
app.post('/bridge/location', bridgeAuth('read:location'), async (req, res) => {
  const ia = req.bridgeIdentity.name;
  const provider = ['gps', 'network', 'passive'].includes(req.body?.provider)
    ? req.body.provider
    : 'network'; // network é mais rápido e consume menos bateria

  logAudit({ ia, scope: 'read:location', operation: 'termux-location', status: 'INICIADO', meta: { provider } });

  try {
    const data = await runTermuxCommand(`termux-location -p ${provider} -r once`);
    logAudit({ ia, scope: 'read:location', operation: 'termux-location', status: 'OK', meta: { provider } });
    res.json({ success: true, data, provider_usado: provider });
  } catch (err) {
    logAudit({ ia, scope: 'read:location', operation: 'termux-location', status: 'ERROR', reason: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /bridge/clipboard/get
 * Lê o conteúdo atual da área de transferência.
 * Escopo: read:clipboard
 */
app.post('/bridge/clipboard/get', bridgeAuth('read:clipboard'), async (req, res) => {
  const ia = req.bridgeIdentity.name;
  try {
    const data = await runTermuxCommand('termux-clipboard-get');
    logAudit({ ia, scope: 'read:clipboard', operation: 'termux-clipboard-get', status: 'OK' });
    res.json({ success: true, data });
  } catch (err) {
    logAudit({ ia, scope: 'read:clipboard', operation: 'termux-clipboard-get', status: 'ERROR', reason: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /bridge/storage/list
 * Lista conteúdo de um diretório (restrito ao Workspace).
 * Escopo: read:clipboard (escopo mais próximo para leitura)
 * Body: { path: "/storage/emulated/0/Workspace" }
 */
app.post('/bridge/storage/list', bridgeAuth('read:clipboard'), async (req, res) => {
  const ia = req.bridgeIdentity.name;
  const targetPath = req.body?.path || '/storage/emulated/0/Workspace';

  // Segurança: bloquear Android/data e path traversal
  const BLOCKED_PATTERNS = ['Android/data', 'Android/obb', '../', '/proc/', '/sys/', '/data/data'];
  const isBlocked = BLOCKED_PATTERNS.some(p => targetPath.includes(p));
  if (isBlocked) {
    logAudit({ ia, scope: 'read:storage', operation: 'storage-list', status: 'DENIED', reason: 'caminho_bloqueado', meta: { path: targetPath } });
    return res.status(403).json({ error: 'Forbidden', detail: 'Caminho bloqueado por política de segurança' });
  }

  // Restringir ao Workspace (sem prejudicar acesso legítimo)
  if (!targetPath.startsWith('/storage/emulated/0/Workspace') && !targetPath.startsWith('~')) {
    logAudit({ ia, scope: 'read:storage', operation: 'storage-list', status: 'DENIED', reason: 'fora_do_workspace' });
    return res.status(403).json({ error: 'Forbidden', detail: 'Acesso restrito ao Workspace' });
  }

  try {
    const data = await runTermuxCommand(`ls -la "${targetPath}"`);
    logAudit({ ia, scope: 'read:storage', operation: 'storage-list', status: 'OK', meta: { path: targetPath } });
    res.json({ success: true, data, path: targetPath });
  } catch (err) {
    logAudit({ ia, scope: 'read:storage', operation: 'storage-list', status: 'ERROR', reason: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

// =============================================================================
// CAMADA 2: ROTAS WRITE — implementadas após validação das READ
// =============================================================================

/**
 * POST /bridge/notification
 * Envia notificação Android.
 * Escopo: write:notification
 * Body: { title: string, content: string, id?: number }
 */
app.post('/bridge/notification', bridgeAuth('write:notification'), async (req, res) => {
  const ia = req.bridgeIdentity.name;
  const { title, content, id } = req.body || {};

  if (!title || !content) {
    return res.status(400).json({ error: 'Bad Request', detail: 'Campos "title" e "content" são obrigatórios' });
  }

  // Sanitização básica: remove aspas duplas que quebrariam o comando
  const safeTitle = title.replace(/"/g, "'");
  const safeContent = content.replace(/"/g, "'");
  const notifId = id || Date.now();

  // Auditoria ANTES de executar (preview do conteúdo)
  logAudit({
    ia,
    scope: 'write:notification',
    operation: 'termux-notification',
    status: 'PENDING',
    meta: { id: notifId, title: safeTitle, preview: safeContent.substring(0, 60) }
  });

  try {
    await runTermuxCommand(`termux-notification --id ${notifId} --title "${safeTitle}" --content "${safeContent}"`);
    logAudit({ ia, scope: 'write:notification', operation: 'termux-notification', status: 'OK', meta: { id: notifId } });
    res.json({ success: true, notification_id: notifId });
  } catch (err) {
    logAudit({ ia, scope: 'write:notification', operation: 'termux-notification', status: 'ERROR', reason: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /bridge/clipboard/set
 * Escreve texto na área de transferência.
 * Escopo: write:clipboard
 * Body: { text: string }
 */
app.post('/bridge/clipboard/set', bridgeAuth('write:clipboard'), async (req, res) => {
  const ia = req.bridgeIdentity.name;
  const { text } = req.body || {};

  if (!text) return res.status(400).json({ error: 'Campo "text" obrigatório' });

  logAudit({
    ia,
    scope: 'write:clipboard',
    operation: 'termux-clipboard-set',
    status: 'PENDING',
    meta: { preview: text.substring(0, 40) }
  });

  try {
    // Usando printf para evitar interpretação de escapes pelo shell
    await runTermuxCommand(`printf '%s' "${text.replace(/"/g, '\\"')}" | termux-clipboard-set`);
    logAudit({ ia, scope: 'write:clipboard', operation: 'termux-clipboard-set', status: 'OK' });
    res.json({ success: true });
  } catch (err) {
    logAudit({ ia, scope: 'write:clipboard', operation: 'termux-clipboard-set', status: 'ERROR', reason: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /bridge/tts — TTS Queue System v2.0
 * Enfileira texto para sintese de voz. Resposta IMEDIATA — nao bloqueia.
 * Segmenta automaticamente textos longos em pontuacao natural.
 * Escopo: write:tts
 * Body : { text: string }   (ate 800 chars — sera segmentado se necessario)
 * Resp : { success, queued, position, segments, playing }
 */
app.post('/bridge/tts', bridgeAuth('write:tts'), (req, res) => {
  const ia = req.bridgeIdentity.name;
  const { text } = req.body || {};

  if (!text || typeof text !== 'string')
    return res.status(400).json({ error: 'Campo "text" obrigatorio (string)' });

  const clean = text.trim().slice(0, 800);
  if (clean.length === 0)
    return res.status(400).json({ error: 'Texto vazio apos sanitizacao' });

  if (ttsQueue.length >= TTS_MAX_QUEUE) {
    logAudit({ ia, scope: 'write:tts', operation: 'enqueue', status: 'REJECTED', reason: 'queue_full' });
    return res.status(429).json({ error: 'Fila TTS cheia (max 10). Tente em instantes.', queue_size: ttsQueue.length });
  }

  const segs = segmentText(clean);
  ttsQueue.push({ text: clean, ia, ts: Date.now(), segments: segs.length });
  const position = ttsQueue.length;

  logAudit({ ia, scope: 'write:tts', operation: 'enqueue', status: 'OK',
    meta: { position, segments: segs.length, chars: clean.length } });

  res.json({ success: true, queued: true, position, segments: segs.length, playing: ttsState.playing });

  // Inicia processamento se ocioso
  setImmediate(processTtsQueue);
});

/**
 * GET /bridge/tts/status — Estado em tempo real da fila TTS.
 * Publico (sem auth) — util para monitoramento por qualquer IA.
 */
app.get('/bridge/tts/status', (req, res) => {
  res.json({
    playing:      ttsState.playing,
    current_ia:   ttsState.currentIA,
    current_text: ttsState.currentText,
    queue_size:   ttsQueue.length,
    queue_items:  ttsQueue.map(i => ({ ia: i.ia, segments: i.segments, chars: i.text.length })),
    total_spoken: ttsState.totalSpoken
  });
});

/**
 * POST /bridge/tts/cancel — Para o TTS imediatamente e limpa a fila.
 * Escopo: write:tts
 */
app.post('/bridge/tts/cancel', bridgeAuth('write:tts'), (req, res) => {
  const ia = req.bridgeIdentity.name;
  const cleared = ttsQueue.length;
  ttsQueue.length = 0;
  ttsState.playing     = false;
  ttsState.currentIA   = null;
  ttsState.currentText = null;
  if (ttsState.proc) {
    try { ttsState.proc.kill('SIGTERM'); } catch (_) {}
    ttsState.proc = null;
  }
  logAudit({ ia, scope: 'write:tts', operation: 'cancel', status: 'OK', meta: { cleared } });
  res.json({ success: true, cleared });
});

/**
 * POST /bridge/intent/open
 * Abre um app Android por package name.
 * Escopo: intent:open_app
 * Body: { package: "com.whatsapp" }
 */
app.post('/bridge/intent/open', bridgeAuth('intent:open_app'), async (req, res) => {
  const ia = req.bridgeIdentity.name;
  const { package: pkg } = req.body || {};

  if (!pkg) return res.status(400).json({ error: 'Campo "package" obrigatório (ex: com.whatsapp)' });

  // Validação de formato: apenas package names válidos
  if (!/^[a-zA-Z][a-zA-Z0-9_]*(\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(pkg)) {
    logAudit({ ia, scope: 'intent:open_app', operation: 'am-start', status: 'DENIED', reason: 'package_name_invalido' });
    return res.status(400).json({ error: 'Package name inválido' });
  }

  logAudit({ ia, scope: 'intent:open_app', operation: 'am-start', status: 'PENDING', meta: { package: pkg } });

  try {
    await runTermuxCommand(`am start $(cmd package resolve-activity --brief ${pkg} | tail -1)`);
    logAudit({ ia, scope: 'intent:open_app', operation: 'am-start', status: 'OK', meta: { package: pkg } });
    res.json({ success: true, package: pkg });
  } catch (err) {
    logAudit({ ia, scope: 'intent:open_app', operation: 'am-start', status: 'ERROR', reason: err.message });
    res.status(500).json({ success: false, error: err.message, hint: 'Verifique se o app está instalado no dispositivo' });
  }
});

// =============================================================================
// ROTAS BLACKLISTADAS — JAMAIS SERÃO IMPLEMENTADAS
// =============================================================================
const BLACKLISTED_ROUTES = [
  '/bridge/sms/send',
  '/bridge/sms',
  '/bridge/camera',
  '/bridge/microphone',
  '/bridge/contacts',
  '/bridge/call'
];

BLACKLISTED_ROUTES.forEach(route => {
  app.all(route, (req, res) => {
    logAudit({
      ia: 'BLOCKED',
      scope: 'BLACKLIST',
      operation: route,
      status: 'DENIED',
      reason: 'rota_permanentemente_bloqueada_em_hardcode'
    });
    res.status(403).json({
      error: 'OPERAÇÃO PERMANENTEMENTE PROIBIDA',
      detail: 'Esta operação consta na blacklist inviolável do Android Bridge Gateway',
      referencia: 'Plano_AndroidBridge_FASE6.md § 6.0.2'
    });
  });
});

// =============================================================================
// KILL SWITCH — Apenas o Owner pode desligar a bridge
// =============================================================================
app.post('/bridge/shutdown', (req, res) => {
  const ownerKey = req.headers['x-owner-key'];

  if (!BRIDGE_OWNER_KEY) {
    return res.status(500).json({ error: 'BRIDGE_OWNER_KEY não configurada no .env' });
  }

  if (ownerKey !== BRIDGE_OWNER_KEY) {
    logAudit({ ia: 'UNKNOWN', scope: 'KILL_SWITCH', operation: 'shutdown', status: 'DENIED', reason: 'owner_key_invalida' });
    return res.status(401).json({ error: 'Unauthorized: Owner Key inválida' });
  }

  logAudit({ ia: 'OWNER', scope: 'KILL_SWITCH', operation: 'shutdown', status: 'OK' });
  res.json({ success: true, message: 'Android Bridge encerrando em 500ms...' });

  setTimeout(() => {
    console.log('[BRIDGE] 🔴 Kill switch acionado pelo Owner. Encerrando...');
    process.exit(0);
  }, 500);
});

// =============================================================================
// ENDPOINT DE AUDITORIA — Apenas Owner
// =============================================================================
app.get('/bridge/audit', (req, res) => {
  const ownerKey = req.headers['x-owner-key'];

  if (!BRIDGE_OWNER_KEY || ownerKey !== BRIDGE_OWNER_KEY) {
    return res.status(401).json({ error: 'Apenas o Owner pode acessar o log de auditoria' });
  }

  const lines = Math.min(parseInt(req.query.lines) || 50, 500);
  const stats = getAuditStats();
  const log = getAuditLog(lines);

  res.json({ success: true, stats, log, lines_retornadas: lines });
});

// =============================================================================
// STATUS PÚBLICO — Sem autenticação (apenas informações não-sensíveis)
// =============================================================================
app.get('/bridge/status', (req, res) => {
  res.json({
    service: 'Android Bridge Gateway',
    version: '2.0.0',
    fase: 'FASE 6.2 — TTS Queue System v2.0',
    status: 'operational',
    timestamp: new Date().toISOString(),
    porta: PORT,
    rotas: {
      read: [
        'POST /bridge/battery       ← read:battery',
        'POST /bridge/wifi          ← read:wifi',
        'POST /bridge/location      ← read:location',
        'POST /bridge/clipboard/get ← read:clipboard',
        'POST /bridge/storage/list  ← read:clipboard'
      ],
      write: [
        'POST /bridge/notification   ← write:notification',
        'POST /bridge/clipboard/set  ← write:clipboard',
        'POST /bridge/tts            ← write:tts (fila async)',
        'GET  /bridge/tts/status      ← publico (monitoramento)',
        'POST /bridge/tts/cancel      ← write:tts (para + limpa fila)',
        'POST /bridge/intent/open    ← intent:open_app'
      ],
      management: [
        'GET  /bridge/status  ← público',
        'GET  /bridge/audit   ← owner only (X-Owner-Key)',
        'POST /bridge/shutdown ← owner only (X-Owner-Key)'
      ],
      blacklist_permanente: [
        '/bridge/sms/send', '/bridge/camera',
        '/bridge/microphone', '/bridge/contacts', '/bridge/call'
      ]
    },
    rate_limit_status: getRateLimitStatus()
  });
});

// =============================================================================
// INICIALIZAÇÃO
// =============================================================================
app.listen(PORT, '127.0.0.1', () => {
  console.log(`\n[ANDROID BRIDGE] 🚀 Gateway v2.0.0 rodando | TTS Queue System v2`);
  console.log(`[ANDROID BRIDGE] 🌐 http://127.0.0.1:${PORT}/bridge/status`);
  console.log(`[ANDROID BRIDGE] 🛡️  Segurança: Escopos + Rate Limiting + Auditoria`);
  console.log(`[ANDROID BRIDGE] 📥 READ: battery | wifi | location | clipboard | storage`);
  console.log(`[ANDROID BRIDGE] 📤 WRITE: notification | clipboard/set | tts | intent/open`);
  console.log(`[ANDROID BRIDGE] 🔴 Kill switch: POST /bridge/shutdown (X-Owner-Key)`);
  console.log(`[ANDROID BRIDGE] ⚠️  Pré-requisito: pkg install termux-api + app Termux:API\n`);

  if (!BRIDGE_OWNER_KEY) {
    console.warn(`[BRIDGE] ⚠️  BRIDGE_OWNER_KEY não definida no .env! Kill switch desabilitado.`);
  }
});
