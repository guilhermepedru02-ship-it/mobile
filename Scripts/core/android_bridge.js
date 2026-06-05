/**
 * android_bridge.js — Android Bridge Gateway
 * FASE 6.1 — Ponte segura entre IAs externas e o Android
 * Versão: 1.0.0 | Criado por Claude Sonnet 4.6 via MCP | 2026-06-01
 *
 * Porta: 4444 (apenas localhost — 127.0.0.1)
 * Dependência: pkg install termux-api + app Termux:API instalado
 *
 * REGRA INVIOLÁVEL: Segurança → Implementação → Teste → Documentação
 */

import express from 'express';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';
import { bridgeAuth, getRateLimitStatus } from './bridge_middleware.js';
import { logAudit, getAuditLog, getAuditStats } from './bridge_audit.js';

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
    const isBlocked = !data.ssid || data.ssid === '<unknown ssid>';
    if (!isBlocked) {
      // Salva cache com SSID valido
      const { writeFileSync } = await import('fs');
      writeFileSync(CACHE_FILE, JSON.stringify({ ssid: data.ssid, ts: Date.now() }));
    } else {
      // Tenta usar cache
      try {
        const { readFileSync } = await import('fs');
        const cached = JSON.parse(readFileSync(CACHE_FILE, 'utf8'));
        if (cached.ssid) { data.ssid = cached.ssid; data.ssid_cached = true; }
      } catch (_) { /* sem cache ainda */ }
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
 * POST /bridge/tts
 * Converte texto em fala (text-to-speech).
 * Escopo: write:tts
 * Body: { text: string }
 */
app.post('/bridge/tts', bridgeAuth('write:tts'), async (req, res) => {
  const ia = req.bridgeIdentity.name;
  const { text } = req.body || {};

  if (!text) return res.status(400).json({ error: 'Campo "text" obrigatório' });
  if (text.length > 500) return res.status(400).json({ error: 'Texto muito longo (máx 500 chars para TTS)' });

  try {
    await runTermuxCommand(`termux-tts-speak "${text.replace(/"/g, "'")}"`);
    logAudit({ ia, scope: 'write:tts', operation: 'termux-tts-speak', status: 'OK' });
    res.json({ success: true });
  } catch (err) {
    logAudit({ ia, scope: 'write:tts', operation: 'termux-tts-speak', status: 'ERROR', reason: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
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
    version: '1.0.0',
    fase: 'FASE 6.1 — READ + WRITE implementados',
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
        'POST /bridge/tts            ← write:tts',
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
  console.log(`\n[ANDROID BRIDGE] 🚀 Gateway v1.0.0 rodando`);
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
