/**
 * server.js — Hub PWA Server
 * FASE 6.2 — Interface unificada (porta 5555)
 * Versão: 1.0.2 | Fix CORS: /hub/services + proxy GET audit | 2026-06-02
 */

import express from 'express';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config({ path: '/storage/emulated/0/Workspace/Scripts/core/.env' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);

const PORT = 5555;
const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';

app.use(express.static(__dirname));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Kanban direto do Cerebro
app.get('/hub/kanban', (req, res) => {
  const kanbanPath = path.join(WORKSPACE_ROOT, 'Cerebro', '03_Tarefas', 'kanban.md');
  try {
    if (fs.existsSync(kanbanPath)) {
      const content = fs.readFileSync(kanbanPath, 'utf8');
      res.json({ success: true, content });
    } else {
      res.status(404).json({ success: false, error: 'kanban.md nao encontrado' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// FIX CORS: verifica servicos server-side (browser nao pode chamar outras portas)
app.get('/hub/services', async (req, res) => {
  const services = [
    { id: 'svc-llama',  port: 11434, path: '/' },
    { id: 'svc-mcp',   port: 3001,  path: '/health' },
    { id: 'svc-agent', port: 3333,  path: '/status' },
    { id: 'svc-api',   port: 4000,  path: '/api/status' },
    { id: 'svc-bridge',port: 4444,  path: '/bridge/status' }
  ];
  const results = {};
  await Promise.all(services.map(async (svc) => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      const r = await fetch('http://127.0.0.1:' + svc.port + svc.path, { signal: controller.signal });
      clearTimeout(timer);
      results[svc.id] = { online: r.ok || r.status < 500 };
    } catch {
      results[svc.id] = { online: false };
    }
  }));
  res.json({ success: true, services: results });
});

// Proxy POST para bridge (evita CORS no browser)
app.post('/proxy/bridge/:action(*)', async (req, res) => {
  const action = req.params.action;
  const token = req.headers['x-bridge-token'] || process.env.BRIDGE_TOKEN_CLAUDE;
  try {
    const response = await fetch('http://127.0.0.1:4444/bridge/' + action, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(503).json({ error: 'Bridge inacessivel', detail: err.message });
  }
});

// FIX CORS: proxy GET para /bridge/audit (auditoria usa GET, nao POST)
app.get('/proxy/bridge/audit', async (req, res) => {
  const ownerKey = req.headers['x-owner-key'];
  const lines = req.query.lines || 100;
  try {
    const response = await fetch('http://127.0.0.1:4444/bridge/audit?lines=' + lines, {
      headers: { 'X-Owner-Key': ownerKey || '' }
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(503).json({ error: 'Bridge inacessivel', detail: err.message });
  }
});

// Status do Hub
app.get('/hub/status', (req, res) => {
  res.json({
    service: 'Hub PWA',
    version: '1.0.3',
    status: 'operational',
    timestamp: new Date().toISOString(),
    porta: PORT
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('[HUB PWA] Interface rodando em http://127.0.0.1:' + PORT);
  console.log('[HUB PWA] Abra no browser do Android para acessar o painel unificado.');
});
