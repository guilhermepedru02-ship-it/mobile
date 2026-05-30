const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';
const logPath = path.join(WORKSPACE_ROOT, 'Logs/executor-audit.log');

function validateAndResolvePath(relativePath) {
    if (!relativePath) throw new Error("Caminho não fornecido.");
    const absolutePath = path.resolve(WORKSPACE_ROOT, relativePath);
    if (!absolutePath.startsWith(WORKSPACE_ROOT)) {
        throw new Error("SECURITY ALERT: Path traversal attempt blocked.");
    }
    return absolutePath;
}

// Helper para executar comandos shell com segurança
function safeExec(command, args = []) {
    // Blacklist de padrões perigosos
    const blacklist = [/rm -rf \//, /chmod 777/, /:(){.*}/, /dd if=/, /mkfs/, /reboot/, /shutdown/, /su/, /sudo/];
    const fullCommand = `${command} ${args.join(' ')}`;
    
    if (blacklist.some(pattern => pattern.test(fullCommand))) {
        throw new Error("SECURITY ALERT: Comando bloqueado pela blacklist.");
    }
    
    try {
        const stdout = execSync(fullCommand, { cwd: WORKSPACE_ROOT, encoding: 'utf8', timeout: 60000 });
        return { success: true, stdout };
    } catch (err) {
        return { success: false, error: err.message, stderr: err.stderr?.toString() };
    }
}

async function executeAction(action) {
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] Action: ${action.type} | Path: ${action.path || action.source || 'N/A'}\n`, 'utf8');

    try {
        switch (action.type) {
            // ... (Manter as operações originais read_file, create_file, etc.)
            // Adicionando as novas operações DevTools:

            case "git_action": {
                const allowedActions = ['status', 'log', 'add', 'commit', 'push', 'pull', 'branch', 'diff'];
                if (!allowedActions.includes(action.action)) {
                    return { success: false, error: `Ação git '${action.action}' não permitida.` };
                }
                const args = action.args || [];
                return safeExec('git', [action.action, ...args]);
            }

            case "npm_action": {
                const allowedCommands = ['install', 'test', 'run', 'list'];
                if (!allowedCommands.includes(action.command)) {
                    return { success: false, error: `Comando npm '${action.command}' não permitido.` };
                }
                const args = action.args || [];
                return safeExec('npm', [action.command, ...args]);
            }

            case "python_exec": {
                const securePath = validateAndResolvePath(action.script_path);
                const args = action.args || [];
                return safeExec('python3', [securePath, ...args]);
            }

            // Manter o restante do switch original...
            default:
                // Se não for uma das novas, tenta as originais (isso será integrado no servidor real)
                return { success: false, error: `Operação '${action.type}' requer integração no executor core.` };
        }
    } catch (err) {
        return { success: false, error: err.message };
    }
}
