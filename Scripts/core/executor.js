import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);
const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';

// Camada de seguranca ativa contra Path Traversal
function validateAndResolvePath(targetPath) {
    const resolved = path.resolve(WORKSPACE_ROOT, targetPath);
    if (!resolved.startsWith(WORKSPACE_ROOT)) {
        throw new Error(`SECURITY ALERT: Violação de sandbox detectada para o caminho: ${targetPath}`);
    }
    return resolved;
}

// ==========================================
// MCP GATEKEEPER (Session State)
// ==========================================
let hasReadRules = false;
let lastActionTime = Date.now();
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutos


// Filtro estrito de comandos maliciosos
const BLACKLISTED_COMMANDS = [
    /rm\s+-rf\s+\/$/,           // Destruição da raiz
    /chmod\s+.*777/,            // Permissões perigosas
    /:.*\(.*\).*\{.*/,          // Fork bombs
    /\bdd\b.*\bif=/,            // Escrita raw em disco
    /\bmkfs\b/,                 // Formatação de partições
    /\breboot\b/,               // Reboot do sistema
    /\bshutdown\b/,             // Desligamento
    /\bsu\b\s/,                 // Escalação de privilégio
    /\bsudo\b/,                 // Escalação de privilégio
    /\bpkill\b.*termux/i,       // Matar o próprio Termux
    />\s*\/dev\/sd/,            // Escrita direta em dispositivos de bloco
    /\bcurl\b.*\|\s*\bbash\b/,  // Pipe de download para execução
];

function verifyCommandSafety(command) {
    for (const pattern of BLACKLISTED_COMMANDS) {
        if (pattern.test(command)) {
            throw new Error(`SECURITY ALERT: Execução negada para o comando de alto risco: ${command}`);
        }
    }
}

export async function processAgentAction(action) {
    // Registro determinístico em log para auditoria posterior
    const logPath = path.join(WORKSPACE_ROOT, 'Logs', 'executor-audit.log');
    
    // Assegura que o diretório de logs exista
    if (!fs.existsSync(path.dirname(logPath))) {
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
    }

    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Executando: ${action.type}\n`, 'utf8');

    // ==========================================
    // GATEKEEPER ENFORCEMENT
    // ==========================================
    const now = Date.now();
    // Se passou muito tempo desde a ultima acao, relock o ambiente (Inatividade)
    if (now - lastActionTime > SESSION_TIMEOUT_MS) {
        hasReadRules = false;
        fs.appendFileSync(logPath, `[GATEKEEPER] Sessao expirada por inatividade. Ambiente bloqueado novamente.\n`, 'utf8');
    }
    lastActionTime = now;

    const isTargetingReadme = action.type === "read_file" && (action.path.includes("00_Sistema/README.md") || action.path.includes("00_Sistema\\README.md"));

    if (!hasReadRules && !isTargetingReadme) {
        const blockMsg = "ACCESS DENIED (GATEKEEPER MCP): Voce nao leu as Diretivas do Sistema. Sua primeira acao deve ser usar 'read_file' no arquivo 'Cerebro/00_Sistema/README.md' para destravar a sessao.";
        fs.appendFileSync(logPath, `[BLOCKED] Tentativa de usar ${action.type} antes de ler as regras.\n`, 'utf8');
        return { success: false, error: blockMsg };
    }

    if (isTargetingReadme && !hasReadRules) {
        hasReadRules = true;
        fs.appendFileSync(logPath, `[UNLOCKED] Regras lidas pela IA. Ambiente destravado.\n`, 'utf8');
    }
    // ==========================================

    try {
        switch (action.type) {
            case "create_file": {
                const securePath = validateAndResolvePath(action.path);
                fs.mkdirSync(path.dirname(securePath), { recursive: true });
                fs.writeFileSync(securePath, action.content, 'utf8');
                return { success: true, detail: `Arquivo persistido em: ${action.path}` };
            }
            case "read_file": {
                const securePath = validateAndResolvePath(action.path);
                if (!fs.existsSync(securePath)) {
                    return { success: false, error: "Arquivo não encontrado." };
                }
                const content = fs.readFileSync(securePath, 'utf8');
                return { success: true, content: content };
            }
            case "append_file": {
                const securePath = validateAndResolvePath(action.path);
                if (!fs.existsSync(securePath)) {
                    return { success: false, error: "Arquivo não encontrado." };
                }
                fs.appendFileSync(securePath, action.content, 'utf8');
                return { success: true, detail: `Conteúdo adicionado ao arquivo: ${action.path}` };
            }
            case "list_dir": {
                const securePath = validateAndResolvePath(action.path);
                if (!fs.existsSync(securePath)) {
                    return { success: false, error: "Diretório não encontrado." };
                }
                const dirents = fs.readdirSync(securePath, { withFileTypes: true });
                const files = dirents.map(dirent => ({
                    name: dirent.name,
                    isDirectory: dirent.isDirectory(),
                }));
                return { success: true, files: files };
            }
            case "run_command": {
                verifyCommandSafety(action.command);
                const { stdout, stderr } = await execPromise(action.command, {
                    cwd: WORKSPACE_ROOT,
                    timeout: 60000, // Timeout hard de 60 segundos por instrução
                    maxBuffer: 1024 * 1024 * 10 // Alocação máxima de 10MB para stdout
                });
                return {
                    success: true,
                    stdout: stdout.toString(),
                    stderr: stderr.toString()
                };
            }
            case "delete_file": {
                const securePath = validateAndResolvePath(action.path);
                if (!fs.existsSync(securePath)) {
                    return { success: false, error: "Arquivo nao encontrado." };
                }
                const stat = fs.statSync(securePath);
                if (stat.isDirectory()) {
                    return { success: false, error: "Para deletar diretorios, remova seus arquivos individualmente." };
                }
                fs.unlinkSync(securePath);
                return { success: true, detail: `Arquivo removido com sucesso: ${action.path}` };
            }
            case "move_file": {
                const secureSource = validateAndResolvePath(action.source);
                const secureDest = validateAndResolvePath(action.destination);
                if (!fs.existsSync(secureSource)) {
                    return { success: false, error: "Arquivo ou diretorio de origem nao encontrado." };
                }
                fs.mkdirSync(path.dirname(secureDest), { recursive: true });
                fs.renameSync(secureSource, secureDest);
                return { success: true, detail: `Movido com sucesso de ${action.source} para ${action.destination}` };
            }
            case "file_info": {
                const securePath = validateAndResolvePath(action.path);
                if (!fs.existsSync(securePath)) {
                    return { success: false, error: "Arquivo ou diretorio nao encontrado." };
                }
                const stat = fs.statSync(securePath);
                return {
                    success: true,
                    info: {
                        size: stat.size,
                        atime: stat.atime,
                        mtime: stat.mtime,
                        ctime: stat.ctime,
                        birthtime: stat.birthtime,
                        isDirectory: stat.isDirectory(),
                        isFile: stat.isFile()
                    }
                };
            }
            case "search_files": {
                const securePath = validateAndResolvePath(action.path);
                if (!fs.existsSync(securePath)) {
                    return { success: false, error: "Diretorio inicial nao encontrado." };
                }
                const query = action.query || "";
                const isRecursive = action.recursive !== false;
                const matches = [];

                function searchDir(currentPath) {
                    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
                    for (const entry of entries) {
                        const fullPath = path.join(currentPath, entry.name);
                        const secureEntryPath = validateAndResolvePath(path.relative(WORKSPACE_ROOT, fullPath));
                        
                        if (entry.isDirectory()) {
                            if (isRecursive) {
                                searchDir(secureEntryPath);
                            }
                        } else if (entry.isFile()) {
                            try {
                                const content = fs.readFileSync(secureEntryPath, 'utf8');
                                if (content.includes(query)) {
                                    matches.push({
                                        path: path.relative(WORKSPACE_ROOT, secureEntryPath),
                                        name: entry.name
                                    });
                                }
                            } catch (e) {
                                // Ignora binarios ou erros de leitura
                            }
                        }
                    }
                }

                searchDir(securePath);
                return { success: true, matches: matches };
            }
            // ==========================================
            // NOVAS OPERAÇÕES: RAG SOBERANO
            // ==========================================
            case "index_cerebro": {
                const { indexCerebro } = await import('./vector_db.js');
                const result = await indexCerebro();
                return { success: true, detail: `Indexação concluída.`, stats: result };
            }
            case "semantic_search": {
                if (!action.query) {
                    return { success: false, error: "Parâmetro 'query' é obrigatório para busca semântica." };
                }
                const topK = action.top_k || 5;
                const { search } = await import('./vector_db.js');
                const result = await search(action.query, topK);
                return result;
            }
            default:
                return { success: false, error: `Operação binária '${action.type}' não homologada.` };
        }
    } catch (err) {
        fs.appendFileSync(logPath, `[ERROR - ${new Date().toISOString()}] Falha: ${err.message}\n`, 'utf8');
        return { success: false, error: err.message };
    }
}
