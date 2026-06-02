/**
 * bridge_audit.js — Auditoria Imutável do Android Bridge
 * FASE 6.0.4 — Toda ação da bridge é registrada aqui.
 * Versão: 1.0.0 | Criado por Claude Sonnet 4.6 via MCP | 2026-06-01
 */

import fs from 'fs';
import path from 'path';

const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';
const LOGS_DIR = path.join(WORKSPACE_ROOT, 'Logs');
const AUDIT_LOG_PATH = path.join(LOGS_DIR, 'android-bridge-audit.log');

/**
 * Registra uma entrada no log de auditoria.
 * @param {object} entry - { ia, scope, operation, status, reason?, meta? }
 */
export function logAudit({ ia, scope, operation, status, reason = null, meta = null }) {
  const timestamp = new Date().toISOString();
  let line = `[${timestamp}] IA=${ia} SCOPE=${scope} OP=${operation} STATUS=${status}`;
  if (reason) line += ` reason=${reason}`;
  if (meta) line += ` meta=${JSON.stringify(meta)}`;
  line += '\n';

  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    // Append imutável — nunca sobrescreve, só adiciona
    fs.appendFileSync(AUDIT_LOG_PATH, line, 'utf8');
  } catch (err) {
    // Falha no log não deve derrubar a bridge — apenas reportar
    console.error(`[BRIDGE-AUDIT] ERRO ao gravar log: ${err.message}`);
  }
}

/**
 * Retorna as últimas N linhas do log de auditoria.
 * @param {number} lines - Quantas linhas retornar (padrão: 50)
 */
export function getAuditLog(lines = 50) {
  try {
    if (!fs.existsSync(AUDIT_LOG_PATH)) {
      return '(Nenhum log de auditoria registrado ainda)';
    }
    const content = fs.readFileSync(AUDIT_LOG_PATH, 'utf8');
    const allLines = content.split('\n').filter(Boolean);
    return allLines.slice(-lines).join('\n');
  } catch (err) {
    return `[AUDIT] Erro ao ler log: ${err.message}`;
  }
}

/**
 * Retorna estatísticas de uso da bridge.
 */
export function getAuditStats() {
  try {
    if (!fs.existsSync(AUDIT_LOG_PATH)) {
      return { total: 0, ok: 0, denied: 0, errors: 0, byIa: {} };
    }
    const content = fs.readFileSync(AUDIT_LOG_PATH, 'utf8');
    const lines = content.split('\n').filter(Boolean);

    const stats = { total: lines.length, ok: 0, denied: 0, errors: 0, byIa: {} };

    for (const line of lines) {
      const iaMatch = line.match(/IA=(\S+)/);
      const statusMatch = line.match(/STATUS=(\S+)/);
      if (!iaMatch || !statusMatch) continue;

      const ia = iaMatch[1];
      const status = statusMatch[1];

      if (!stats.byIa[ia]) stats.byIa[ia] = { ok: 0, denied: 0, errors: 0 };

      if (status === 'OK') { stats.ok++; stats.byIa[ia].ok++; }
      else if (status === 'DENIED') { stats.denied++; stats.byIa[ia].denied++; }
      else if (status === 'ERROR') { stats.errors++; stats.byIa[ia].errors++; }
    }

    return stats;
  } catch (err) {
    return { error: err.message };
  }
}
