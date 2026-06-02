/**
 * server.js — Hub PWA Server
 * FASE 6.2 — Interface unificada (porta 5555)
 * Versão: 1.0.1 | Criado por Claude Sonnet 4.6 via MCP | 2026-06-01
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

// Serve arquivos estáticos da pasta hub_pwa
app.use(express.static(__dirname));
app.use(express.json());

// Rota principal
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
      res.status(404).json({ success: false, error: 'kanban.md não encontrado' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Proxy para bridge (evita CORS no browser)
app.post('/proxy/bridge/:action(*)', async (req, res) => {
  const action = req.params.action;
  const token = req.headers['x-bridge-token'] || process.env.BRIDGE_TOKEN_CLAUDE;

  try {
    const response = await fetch(`http://127.0.0.1:4444/bridge/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(503).json({ error: 'Bridge inacessível', detail: err.message });
  }
});

// Status do Hub
app.get('/hub/status', (req, res) => {
  res.json({
    service: 'Hub PWA',
    version: '1.0.1',
    status: 'operational',
    timestamp: new Date().toISOString(),
    porta: PORT
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[HUB PWA] 🌐 Interface rodando em http://127.0.0.1:${PORT}`);
  console.log(`[HUB PWA] Abra no browser do Android para acessar o painel unificado.`);
});
