import express from 'express';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import dotenv from 'dotenv';
import { requireAuth } from './auth_middleware.js';

// Carrega o .env centralizado do bot
dotenv.config({ path: path.join('/storage/emulated/0/Workspace', 'Projetos', 'telegram_bot', '.env') });

const app = express();
app.use(express.json()); // Permite ler o corpo das requisições POST
app.use(requireAuth); // TODAS as rotas desta API exigem autenticação

const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';

function getTodayDateString() {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

app.get('/api/tarefas', (req, res) => {
  try {
    const kanbanPath = path.join(WORKSPACE_ROOT, 'Cerebro', '03_Tarefas', 'kanban.md');
    if (fs.existsSync(kanbanPath)) {
      const content = fs.readFileSync(kanbanPath, 'utf8');
      res.json({ success: true, content });
    } else {
      res.status(404).json({ success: false, error: 'Kanban não encontrado' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/diario/hoje', (req, res) => {
  const dateStr = getTodayDateString();
  const diaryPath = path.join(WORKSPACE_ROOT, 'Cerebro', '04_Diario', `${dateStr}.md`);
  try {
    if (fs.existsSync(diaryPath)) {
      const content = fs.readFileSync(diaryPath, 'utf8');
      res.json({ success: true, content });
    } else {
      res.status(404).json({ success: false, error: 'Diário de hoje não encontrado' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/diario', (req, res) => {
  const { nota } = req.body;
  if (!nota) return res.status(400).json({ success: false, error: 'Campo "nota" obrigatório no body JSON' });

  const dateStr = getTodayDateString();
  const timeStr = new Date().toTimeString().split(' ')[0];
  const diaryPath = path.join(WORKSPACE_ROOT, 'Cerebro', '04_Diario', `${dateStr}.md`);
  
  try {
    let fileContent = '';
    if (fs.existsSync(diaryPath)) {
      fileContent = fs.readFileSync(diaryPath, 'utf8');
    } else {
      fileContent = `# Diário de Bordo - ${dateStr}\n\n`;
    }
    
    fileContent += `\n- [${timeStr}] (API REST) ${nota}\n`;
    fs.writeFileSync(diaryPath, fileContent, 'utf8');
    
    res.json({ success: true, message: 'Nota adicionada com sucesso' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/api/scraper', (req, res) => {
  const scriptPath = path.join(WORKSPACE_ROOT, 'Projetos', 'tech_scraper.py');
  exec(`python ${scriptPath}`, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({ success: false, error: error.message });
    }
    res.json({ success: true, output: stdout });
  });
});

app.get('/api/status', (req, res) => {
  res.json({ success: true, status: 'API REST operante', timestamp: new Date().toISOString() });
});

const PORT = 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[API REST] Rodando de forma autônoma na porta ${PORT}`);
  console.log(`[API REST] Segurança: Bearer Token exigido em todas as rotas.`);
});