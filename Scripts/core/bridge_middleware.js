/**
 * bridge_middleware.js — Autenticação, Escopos e Rate Limiting
 * FASE 6.0.3 — Camada de segurança do Android Bridge Gateway
 * Versão: 1.0.0 | Criado por Claude Sonnet 4.6 via MCP | 2026-06-01
 *
 * ORDEM DE VERIFICAÇÃO (inviolável):
 * 1. Extrair token do request
 * 2. Identificar a IA pelo token
 * 3. Verificar se o escopo solicitado está autorizado
 * 4. Verificar rate limit (por minuto e por dia)
 * 5. Auditar resultado
 * 6. Prosseguir ou bloquear
 */

import fs from 'fs';
import path from 'path';
import { logAudit } from './bridge_audit.js';

const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';
const PERMISSIONS_PATH = path.join(WORKSPACE_ROOT, 'Scripts', 'core', 'bridge_permissions.json');

// Contadores de rate limit em memória (resetam com reinício do servidor)
// Estrutura: { iaName: { minute: {count, resetAt}, day: {count, resetAt} } }
const _rateLimitCounters = {};

/**
 * Lê bridge_permissions.json do disco (sem cache para refletir edições em tempo real).
 */
function loadPermissions() {
  try {
    const raw = fs.readFileSync(PERMISSIONS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[BRIDGE-MIDDLEWARE] Erro ao carregar permissões: ${err.message}`);
    return { identities: {} };
  }
}

/**
 * Verifica e incrementa os contadores de rate limit para uma IA.
 * Retorna { allowed: true } ou { allowed: false, reason: string }
 */
function checkAndIncrementRateLimit(iaName, rateConfig) {
  const now = Date.now();

  if (!_rateLimitCounters[iaName]) {
    _rateLimitCounters[iaName] = {
      minute: { count: 0, resetAt: now + 60_000 },
      day:    { count: 0, resetAt: now + 86_400_000 }
    };
  }

  const counter = _rateLimitCounters[iaName];

  // Reset janelas expiradas
  if (now > counter.minute.resetAt) {
    counter.minute = { count: 0, resetAt: now + 60_000 };
  }
  if (now > counter.day.resetAt) {
    counter.day = { count: 0, resetAt: now + 86_400_000 };
  }

  if (counter.minute.count >= rateConfig.requests_per_minute) {
    return { allowed: false, reason: 'rate_limit_por_minuto_excedido' };
  }
  if (counter.day.count >= rateConfig.requests_per_day) {
    return { allowed: false, reason: 'rate_limit_diario_excedido' };
  }

  // Apenas incrementa se passou em todas as verificações
  counter.minute.count++;
  counter.day.count++;
  return { allowed: true };
}

/**
 * Middleware principal: bridgeAuth(requiredScope)
 * Uso: app.post('/bridge/battery', bridgeAuth('read:battery'), handler)
 *
 * Injeta req.bridgeIdentity = { name, scopes } quando autorizado.
 */
export function bridgeAuth(requiredScope) {
  return (req, res, next) => {
    const permissions = loadPermissions();

    // ── Passo 1: Extrair token ─────────────────────────────────────
    let token = null;
    const authHeader = req.headers['authorization'];
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7);
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      logAudit({ ia: 'UNKNOWN', scope: requiredScope, operation: 'AUTH', status: 'DENIED', reason: 'token_ausente' });
      return res.status(401).json({
        error: 'Unauthorized',
        detail: "Token ausente. Envie 'Authorization: Bearer SEU_TOKEN' ou '?token=SEU_TOKEN'"
      });
    }

    // ── Passo 2: Identificar a IA ─────────────────────────────────
    let iaName = null;
    let iaConfig = null;

    for (const [name, config] of Object.entries(permissions.identities)) {
      const expectedToken = process.env[config.token_env];
      if (expectedToken && token === expectedToken) {
        iaName = name;
        iaConfig = config;
        break;
      }
    }

    if (!iaName) {
      logAudit({ ia: 'UNKNOWN', scope: requiredScope, operation: 'AUTH', status: 'DENIED', reason: 'token_invalido' });
      return res.status(401).json({ error: 'Unauthorized', detail: 'Token inválido' });
    }

    // ── Passo 3: Verificar escopo ─────────────────────────────────
    if (requiredScope && !iaConfig.scopes.includes(requiredScope)) {
      logAudit({ ia: iaName, scope: requiredScope, operation: 'SCOPE_CHECK', status: 'DENIED', reason: 'escopo_nao_autorizado' });
      return res.status(403).json({
        error: 'Forbidden',
        detail: `Escopo '${requiredScope}' não autorizado para '${iaName}'`,
        scopes_autorizados: iaConfig.scopes
      });
    }

    // ── Passo 4: Rate limit ───────────────────────────────────────
    const rlResult = checkAndIncrementRateLimit(iaName, iaConfig.rate_limit);
    if (!rlResult.allowed) {
      logAudit({ ia: iaName, scope: requiredScope, operation: 'RATE_LIMIT', status: 'DENIED', reason: rlResult.reason });
      return res.status(429).json({
        error: 'Too Many Requests',
        detail: rlResult.reason
      });
    }

    // ── Passo 5: Autorizado ───────────────────────────────────────
    req.bridgeIdentity = { name: iaName, scopes: iaConfig.scopes };
    next();
  };
}

/**
 * Exporta contadores de rate limit (para diagnóstico interno).
 */
export function getRateLimitStatus() {
  return _rateLimitCounters;
}
