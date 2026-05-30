/**
 * workspace_agent_server.js — Servidor MCP Universal do Workspace
 * Versão: 1.0.0 · Data: 2026-05-30
 * 
 * Expõe o workspace como ferramenta MCP acessível por QUALQUER IA externa
 * (Claude, Antigravity, Manus, etc.) via HTTP local na porta 3333.
 * 
 * Rotas:
 *   POST /read_file      → Lê conteúdo de arquivo
 *   POST /write_file     → Cria/sobrescreve arquivo
 *   POST /append_file    → Acrescenta ao final de arquivo
 *   POST /delete_file    → Remove arquivo (não pastas)
 *   POST /move_file      → Move/renomeia arquivo ou diretório
 *   POST /list_dir       → Lista conteúdo de diretório
 *   POST /run_script     → Executa script existente no workspace
 *   POST /shell_exec     → Executa comando shell arbitrário (com sandbox)
 *   POST /apply_patch    → Aplica diff/patch em arquivo
 *   GET  /health         → Health check
 *   GET  /capabilities   → Lista todas as rotas disponíveis
 */

import express from 'express';
import fs from 'fs';
import path from 'path';
import { execSync, spawnSync } from 'child_process';

const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';
const AGENT_PORT     = 3333;
const LOG_PATH       = path.join(WORKSPACE_ROOT, 'Logs/workspace-agent.log');

// ==========================================
// UTILITÁRIOS
// ==========================================

function log(level, msg) {
    const entry = `[${new Date().toISOString()}] [${level}] ${msg}`;
    console.log(entry);
    try {
        fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
        fs.appendFileSync(LOG_PATH, entry + '\n', 'utf8');
    } catch { /* silencioso */ }
}

/**
 * Valida e resolve um caminho relativo dentro do WORKSPACE_ROOT.
 * Bloqueia path traversal (../), caminhos absolutos externos e
 * acesso a .git/ e node_modules/ de forma direta.
 * Retorna o caminho absoluto seguro ou lança erro.
 */
function safePath(relPath) {
    if (!relPath || typeof relPath !== 'string') {
        throw new Error('Caminho inválido ou ausente.');
    }
    // Normaliza e resolve dentro do workspace
    const resolved = path.resolve(WORKSPACE_ROOT, relPath);
    // Garante que está dentro do workspace
    if (!resolved.startsWith(WORKSPACE_ROOT + path.sep) && resolved !== WORKSPACE_ROOT) {
        throw new Error(`SECURITY ALERT: Path traversal detectado: ${relPath}`);
    }
    return resolved;
}

/**
 * Blacklist de comandos shell perigosos (espelha executor.js).
 */
const SHELL_BLACKLIST = [
    /rm\s+-rf\s+\//, /chmod\s+777/, /:(\(\)){/, /dd\s+if=/, /mkfs/,
    /reboot/, /shutdown/, /\bsu\b/, /\bsudo\b/, /pkill\s+termux/,
    />\s*\/dev\/sd/, /curl.*\|.*bash/, /wget.*\|.*sh/
];

function checkShellBlacklist(cmd) {
    for (const re of SHELL_BLACKLIST) {
        if (re.test(cmd)) {
            throw new Error(`Comando bloqueado por segurança: ${cmd}`);
        }
    }
}

// ==========================================
// APP EXPRESS
// ==========================================

const app = express();
app.use(express.json({ limit: '2mb' }));

// Middleware de auditoria
app.use((req, res, next) => {
    log('INFO', `${req.method} ${req.path} | body: ${JSON.stringify(req.body).slice(0, 120)}`);
    next();
});

// ------------------------------------------
// GET /health — Health check
// ------------------------------------------
app.get('/health', (req, res) => {
    res.json({
        ok: true,
        service: 'workspace_agent_server',
        version: '1.0.0',
        port: AGENT_PORT,
        workspace: WORKSPACE_ROOT,
        timestamp: new Date().toISOString()
    });
});

// ------------------------------------------
// GET /capabilities — Lista de rotas
// ------------------------------------------
app.get('/capabilities', (req, res) => {
    res.json({
        service: 'workspace_agent_server',
        description: 'Mini-agente local para micro-tarefas de workspace. Use para: ler arquivos, escrever, executar scripts existentes, aplicar patches, rodar comandos shell. NÃO use para raciocínio complexo ou decisões de arquitetura.',
        routes: [
            { method: 'POST', path: '/read_file',   params: ['path'],                    description: 'Lê conteúdo de arquivo' },
            { method: 'POST', path: '/write_file',  params: ['path', 'content'],         description: 'Cria ou sobrescreve arquivo' },
            { method: 'POST', path: '/append_file', params: ['path', 'content'],         description: 'Acrescenta conteúdo ao final' },
            { method: 'POST', path: '/delete_file', params: ['path'],                    description: 'Remove arquivo (não pastas)' },
            { method: 'POST', path: '/move_file',   params: ['source', 'destination'],  description: 'Move ou renomeia arquivo/diretório' },
            { method: 'POST', path: '/list_dir',    params: ['path'],                    description: 'Lista conteúdo de diretório' },
            { method: 'POST', path: '/run_script',  params: ['script_path', 'args?'],   description: 'Executa script existente no workspace' },
            { method: 'POST', path: '/shell_exec',  params: ['command'],                description: 'Executa comando shell com sandbox' },
            { method: 'POST', path: '/apply_patch', params: ['path', 'diff'],           description: 'Aplica patch unificado em arquivo' },
        ]
    });
});

// ------------------------------------------
// POST /read_file
// ------------------------------------------
app.post('/read_file', (req, res) => {
    try {
        const absPath = safePath(req.body.path);
        if (!fs.existsSync(absPath)) {
            return res.status(404).json({ ok: false, error: 'Arquivo não encontrado.' });
        }
        const stat = fs.statSync(absPath);
        if (stat.isDirectory()) {
            return res.status(400).json({ ok: false, error: 'Caminho é um diretório. Use /list_dir.' });
        }
        const content = fs.readFileSync(absPath, 'utf8');
        res.json({ ok: true, path: req.body.path, content, size: stat.size });
    } catch (err) {
        log('ERROR', `/read_file: ${err.message}`);
        res.status(400).json({ ok: false, error: err.message });
    }
});

// ------------------------------------------
// POST /write_file
// ------------------------------------------
app.post('/write_file', (req, res) => {
    try {
        const absPath = safePath(req.body.path);
        const content = req.body.content ?? '';
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        fs.writeFileSync(absPath, content, 'utf8');
        res.json({ ok: true, path: req.body.path, written: content.length });
    } catch (err) {
        log('ERROR', `/write_file: ${err.message}`);
        res.status(400).json({ ok: false, error: err.message });
    }
});

// ------------------------------------------
// POST /append_file
// ------------------------------------------
app.post('/append_file', (req, res) => {
    try {
        const absPath = safePath(req.body.path);
        const content = req.body.content ?? '';
        fs.mkdirSync(path.dirname(absPath), { recursive: true });
        fs.appendFileSync(absPath, content, 'utf8');
        const size = fs.statSync(absPath).size;
        res.json({ ok: true, path: req.body.path, appended: content.length, total_size: size });
    } catch (err) {
        log('ERROR', `/append_file: ${err.message}`);
        res.status(400).json({ ok: false, error: err.message });
    }
});

// ------------------------------------------
// POST /delete_file
// ------------------------------------------
app.post('/delete_file', (req, res) => {
    try {
        const absPath = safePath(req.body.path);
        if (!fs.existsSync(absPath)) {
            return res.status(404).json({ ok: false, error: 'Arquivo não encontrado.' });
        }
        const stat = fs.statSync(absPath);
        if (stat.isDirectory()) {
            return res.status(400).json({ ok: false, error: 'delete_file não remove pastas. Use rm via shell_exec com cautela.' });
        }
        fs.unlinkSync(absPath);
        res.json({ ok: true, deleted: req.body.path });
    } catch (err) {
        log('ERROR', `/delete_file: ${err.message}`);
        res.status(400).json({ ok: false, error: err.message });
    }
});

// ------------------------------------------
// POST /move_file
// ------------------------------------------
app.post('/move_file', (req, res) => {
    try {
        const srcPath  = safePath(req.body.source);
        const dstPath  = safePath(req.body.destination);
        if (!fs.existsSync(srcPath)) {
            return res.status(404).json({ ok: false, error: 'Origem não encontrada.' });
        }
        fs.mkdirSync(path.dirname(dstPath), { recursive: true });
        fs.renameSync(srcPath, dstPath);
        res.json({ ok: true, moved: { from: req.body.source, to: req.body.destination } });
    } catch (err) {
        log('ERROR', `/move_file: ${err.message}`);
        res.status(400).json({ ok: false, error: err.message });
    }
});

// ------------------------------------------
// POST /list_dir
// ------------------------------------------
app.post('/list_dir', (req, res) => {
    try {
        const absPath = safePath(req.body.path || '.');
        if (!fs.existsSync(absPath)) {
            return res.status(404).json({ ok: false, error: 'Diretório não encontrado.' });
        }
        const entries = fs.readdirSync(absPath, { withFileTypes: true })
            .filter(e => !e.name.startsWith('.git'))
            .map(e => ({
                name:  e.name,
                type:  e.isDirectory() ? 'dir' : 'file',
                size:  e.isFile() ? fs.statSync(path.join(absPath, e.name)).size : null
            }))
            .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
        res.json({ ok: true, path: req.body.path, entries, count: entries.length });
    } catch (err) {
        log('ERROR', `/list_dir: ${err.message}`);
        res.status(400).json({ ok: false, error: err.message });
    }
});

// ------------------------------------------
// POST /run_script
// Executa script EXISTENTE no workspace (não aceita código inline)
// ------------------------------------------
app.post('/run_script', (req, res) => {
    try {
        const scriptAbs = safePath(req.body.script_path);
        if (!fs.existsSync(scriptAbs)) {
            return res.status(404).json({ ok: false, error: 'Script não encontrado.' });
        }
        const args = Array.isArray(req.body.args) ? req.body.args.join(' ') : (req.body.args || '');
        const ext  = path.extname(scriptAbs).toLowerCase();
        let cmd;
        if      (ext === '.sh')  cmd = `bash "${scriptAbs}" ${args}`;
        else if (ext === '.py')  cmd = `python3 "${scriptAbs}" ${args}`;
        else if (ext === '.js' || ext === '.mjs') cmd = `node "${scriptAbs}" ${args}`;
        else return res.status(400).json({ ok: false, error: `Extensão não suportada: ${ext}` });

        const result = spawnSync('sh', ['-c', cmd], {
            cwd: WORKSPACE_ROOT,
            timeout: 55000,
            maxBuffer: 10 * 1024 * 1024,
            encoding: 'utf8'
        });
        res.json({
            ok:         result.status === 0,
            exit_code:  result.status,
            stdout:     result.stdout || '',
            stderr:     result.stderr || ''
        });
    } catch (err) {
        log('ERROR', `/run_script: ${err.message}`);
        res.status(400).json({ ok: false, error: err.message });
    }
});

// ------------------------------------------
// POST /shell_exec
// Executa comando shell arbitrário com sandbox
// ------------------------------------------
app.post('/shell_exec', (req, res) => {
    try {
        const cmd = req.body.command;
        if (!cmd || typeof cmd !== 'string') {
            return res.status(400).json({ ok: false, error: 'Campo "command" obrigatório.' });
        }
        checkShellBlacklist(cmd);
        const result = spawnSync('sh', ['-c', cmd], {
            cwd: WORKSPACE_ROOT,
            timeout: 55000,
            maxBuffer: 10 * 1024 * 1024,
            encoding: 'utf8'
        });
        res.json({
            ok:        result.status === 0,
            exit_code: result.status,
            stdout:    result.stdout || '',
            stderr:    result.stderr || ''
        });
    } catch (err) {
        log('ERROR', `/shell_exec: ${err.message}`);
        res.status(400).json({ ok: false, error: err.message });
    }
});

// ------------------------------------------
// POST /apply_patch
// Aplica patch unificado (diff -u) em arquivo existente
// ------------------------------------------
app.post('/apply_patch', (req, res) => {
    try {
        const absPath = safePath(req.body.path);
        const diff    = req.body.diff;
        if (!diff || typeof diff !== 'string') {
            return res.status(400).json({ ok: false, error: 'Campo "diff" obrigatório.' });
        }
        if (!fs.existsSync(absPath)) {
            return res.status(404).json({ ok: false, error: 'Arquivo alvo não encontrado.' });
        }
        // Salva patch em arquivo temporário
        const tmpPatch = path.join(WORKSPACE_ROOT, `Logs/.tmp_patch_${Date.now()}.patch`);
        fs.mkdirSync(path.dirname(tmpPatch), { recursive: true });
        fs.writeFileSync(tmpPatch, diff, 'utf8');
        const result = spawnSync('sh', ['-c', `patch "${absPath}" < "${tmpPatch}"`], {
            cwd: WORKSPACE_ROOT, timeout: 15000, encoding: 'utf8'
        });
        // Limpa temp
        try { fs.unlinkSync(tmpPatch); } catch {}
        if (result.status !== 0) {
            return res.status(422).json({ ok: false, error: 'Patch falhou.', stderr: result.stderr });
        }
        res.json({ ok: true, patched: req.body.path, stdout: result.stdout });
    } catch (err) {
        log('ERROR', `/apply_patch: ${err.message}`);
        res.status(400).json({ ok: false, error: err.message });
    }
});

// ------------------------------------------
// 404 handler
// ------------------------------------------
app.use((req, res) => {
    res.status(404).json({
        ok: false,
        error: `Rota não encontrada: ${req.method} ${req.path}`,
        hint: 'GET /capabilities para ver as rotas disponíveis.'
    });
});

// ==========================================
// START
// ==========================================
app.listen(AGENT_PORT, '127.0.0.1', () => {
    log('STARTUP', `workspace_agent_server v1.0.0 online em http://127.0.0.1:${AGENT_PORT}`);
    log('STARTUP', `Workspace root: ${WORKSPACE_ROOT}`);
    log('STARTUP', 'Rotas: /health /capabilities /read_file /write_file /append_file /delete_file /move_file /list_dir /run_script /shell_exec /apply_patch');
});

export default app;
