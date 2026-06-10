import fs from 'fs';
import path from 'path';
import { exec, spawn, execSync } from 'child_process';
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
    /:.*\(\s*\)\s*\{/,         // Fork bombs (precisao melhorada: evita falso positivo com loops)
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


// ==============================================================================
// GATE BIOMETRICO — Camada 7 de Seguranca
// Comandos que exigem autenticacao por digital antes de executar.
// ==============================================================================
const BIOMETRIC_GATE_SCRIPT = '/data/data/com.termux/files/home/storage/shared/Workspace/Scripts/core/biometric_gate.sh';

const BIOMETRIC_COMMANDS = [
    { pattern: /git.*push/,          label: 'git push para GitHub' },
    { pattern: /termux-sms-send/,         label: 'envio de SMS' },
    { pattern: /sms-send/,               label: 'envio de SMS' },
    { pattern: /\.env/,                    label: 'acesso ao arquivo .env' },
    { pattern: /cat.*\.env/,               label: 'leitura do .env' },
    { pattern: /BRIDGE_TOKEN/,           label: 'acesso a tokens sensiveis' },
];

const BIOMETRIC_PATHS = [
    '00_Sistema/',  // qualquer write em 00_Sistema exige biometria
];

function verifyBiometricRequirement(action) {
    let label = null;

    // Verifica run_command
    if (action.type === 'run_command' && action.command) {
        for (const rule of BIOMETRIC_COMMANDS) {
            if (rule.pattern.test(action.command)) {
                label = rule.label;
                break;
            }
        }
    }

    // Verifica operacoes de escrita em 00_Sistema
    const writingOps = ['create_file', 'append_file', 'write_file', 'delete_file', 'move_file'];
    if (!label && writingOps.includes(action.type)) {
        const targetPath = action.path || action.dest || action.destination || '';
        if (BIOMETRIC_PATHS.some(p => targetPath.includes(p))) {
            label = `alteracao em 00_Sistema: ${targetPath.split('/').pop()}`;
        }
    }

    if (!label) return; // nao requer biometria

    // Dispara o gate biometrico (sincrono — bloqueia ate ter resposta)
    try {
        execSync(`bash "${BIOMETRIC_GATE_SCRIPT}" "${label}"`, { stdio: 'pipe', timeout: 30000 });
        // exit 0 = autorizado — continua normalmente
    } catch (err) {
        // exit 1 = negado/cancelado; exit 2 = unavailable
        const exitCode = err.status || 1;
        const reason = exitCode === 2 ? 'BIOMETRIC_UNAVAILABLE' : 'AUTH_DENIED';
        throw new Error(`SECURITY ALERT: Operacao bloqueada pelo gate biometrico (${reason}): ${label}`);
    }
}

function verifyCommandSafety(command) {
    for (const pattern of BLACKLISTED_COMMANDS) {
        if (pattern.test(command)) {
            throw new Error(`SECURITY ALERT: Execução negada para o comando de alto risco: ${command}`);
        }
    }
}


// ==============================================================================
// TTS NARRATOR v2.0 — Narração imersiva, robústa e obrigatória
// PRE-acao: anuncia o que vai fazer (contextual, não genérico)
// POS-acao: narra o resultado real com dados extraidos da resposta
// A IA não controla isso — o executor dispara sempre, automaticamente.
// ==============================================================================
const BRIDGE_TTS_URL           = 'http://127.0.0.1:4444/bridge/tts';
const BRIDGE_TOKEN_CLAUDE      = process.env.BRIDGE_TOKEN_CLAUDE      || '';
const BRIDGE_TOKEN_ANTIGRAVITY = process.env.BRIDGE_TOKEN_ANTIGRAVITY || '';
const BRIDGE_TOKEN_QWEN        = process.env.BRIDGE_TOKEN_QWEN        || '';

const IA_TOKEN_MAP = {
  claude:      BRIDGE_TOKEN_CLAUDE,
  antigravity: BRIDGE_TOKEN_ANTIGRAVITY,
  qwen_local:  BRIDGE_TOKEN_QWEN,
};

/**
 * Envia texto para fila TTS via Bridge. Fire-and-forget.
 */
function ttsSpeak(iaName, text) {
  if (!text) return;
  const token = IA_TOKEN_MAP[iaName?.toLowerCase()] || BRIDGE_TOKEN_CLAUDE;
  const payload = JSON.stringify({ text, ia: iaName || 'IA' });
  if (token) {
    const proc = spawn('curl', [
      '-s', '-X', 'POST',
      '-H', `Authorization: Bearer ${token}`,
      '-H', 'Content-Type: application/json',
      '-d', payload,
      BRIDGE_TTS_URL
    ], { stdio: 'ignore', detached: true });
    proc.unref();
  } else {
    const proc = spawn('termux-tts-speak', [text], { stdio: 'ignore', detached: true });
    proc.unref();
  }
}

/**
 * PRE-ACAO: narra o que a IA vai fazer, com contexto real do action.
 * Cobre todos os tipos de acao — nada fica sem voz.
 */
function buildPreNarration(iaName, action) {
  const n = iaName || 'IA';
  const file = (action.path || action.dest || action.destination || '').split('/').pop();
  const cmd  = (action.command || '').trim();

  switch (action.type) {
    case 'run_command': {
      // Narra contexto real do comando, nao apenas o binario
      if (/git.*push/.test(cmd))        return `${n}: enviando código para o GitHub`;
      if (/git.*commit/.test(cmd))      return `${n}: registrando commit no repositório`;
      if (/git.*status/.test(cmd))      return `${n}: verificando status do repositório`;
      if (/git.*log/.test(cmd))         return `${n}: lendo histórico de commits`;
      if (/pkill|kill/.test(cmd))       return `${n}: encerrando processo`;
      if (/node.*server|node.*mcp/.test(cmd)) return `${n}: iniciando servidor`;
      if (/curl.*bridge\/tts/.test(cmd))      return null; // silencia auto-narracoes
      if (/curl.*bridge\/battery/.test(cmd))  return `${n}: lendo bateria do dispositivo`;
      if (/curl.*bridge\/wifi/.test(cmd))      return `${n}: lendo status do Wi-Fi`;
      if (/curl.*bridge\/location/.test(cmd))  return `${n}: obtendo localização GPS`;
      if (/curl.*bridge/.test(cmd))            return `${n}: consultando Android Bridge`;
      if (/curl.*health/.test(cmd))            return `${n}: verificando saúde dos serviços`;
      if (/npm.*install/.test(cmd))    return `${n}: instalando dependências`;
      if (/npm.*run/.test(cmd))        return `${n}: executando script npm`;
      if (/python3?/.test(cmd))        return `${n}: executando script Python`;
      if (/termux-sms-send/.test(cmd)) return `${n}: enviando SMS — aguardando biometria`;
      if (/termux-fingerprint/.test(cmd)) return null; // silencia o gate em si
      if (/free -m|df -h/.test(cmd))   return `${n}: verificando uso de memória e disco`;
      if (/ps aux/.test(cmd))          return `${n}: listando processos ativos`;
      if (/cat.*\.env/.test(cmd))      return `${n}: acessando variáveis de ambiente`;
      if (/tail.*log/.test(cmd))       return `${n}: lendo logs do sistema`;
      if (/sed |awk |grep /.test(cmd)) return `${n}: processando arquivo de texto`;
      // Generico — extrai binario
      const bin = cmd.split(/\s+/)[0].replace(/.*\//, '');
      return `${n}: executando ${bin}`;
    }
    case 'read_file':
      if ((action.path||'').includes('kanban'))    return `${n}: lendo kanban de tarefas`;
      if ((action.path||'').includes('README'))    return `${n}: carregando diretivas do sistema`;
      if ((action.path||'').includes('seguranca')) return `${n}: verificando camadas de segurança`;
      if ((action.path||'').includes('system_prompt')) return `${n}: carregando protocolo operacional`;
      if ((action.path||'').includes('Memoria-RAG')) return `${n}: consultando memória de longo prazo`;
      if ((action.path||'').includes('tool_registry')) return `${n}: carregando registro de ferramentas`;
      return `${n}: lendo ${file}`;
    case 'create_file':
      if ((action.path||'').includes('Memoria-RAG')) return `${n}: registrando memória de longo prazo`;
      if ((action.path||'').includes('04_Diario'))  return `${n}: escrevendo entrada no diário`;
      if ((action.path||'').includes('03_Tarefas')) return `${n}: atualizando tarefas no kanban`;
      return `${n}: criando arquivo ${file}`;
    case 'append_file':
      return `${n}: atualizando ${file} com novos dados`;
    case 'delete_file':
      return `${n}: removendo arquivo ${file} — operação irreversível`;
    case 'move_file':
      return `${n}: movendo ${file} para nova localização`;
    case 'index_cerebro':
      return `${n}: reindexando toda a base de conhecimento`;
    case 'list_directory':
      return null; // silencioso — operacao de leitura simples
    default:
      return null;
  }
}

/**
 * POS-ACAO: extrai dados reais do resultado e narra de forma natural.
 * Só narra se o resultado tiver dados relevantes.
 */
function buildPostNarration(iaName, action, result) {
  const n = iaName || 'IA';
  if (!result || !result.success) {
    // Narra falhas em operações criticas
    const criticalTypes = ['create_file', 'append_file', 'delete_file', 'run_command'];
    if (criticalTypes.includes(action.type)) {
      return `${n}: operação falhou — ${(result?.error || 'erro desconhecido').slice(0, 60)}`;
    }
    return null;
  }

  const cmd = (action.command || '').trim();

  switch (action.type) {
    case 'run_command': {
      const out = (result.stdout || '').trim();

      // Diagnóstico de bateria
      if (/bridge\/battery/.test(cmd)) {
        try {
          const d = JSON.parse(out).data;
          const statusPT = d.status === 'FULL' ? 'totalmente carregada' :
                           d.status === 'CHARGING' ? 'carregando' :
                           d.status === 'DISCHARGING' ? 'descarregando' : d.status.toLowerCase();
          return `${n}: bateria ${d.percentage} por cento, ${statusPT}, temperatura ${d.temperature} graus`;
        } catch(e) {}
      }
      // Diagnostico Wi-Fi
      if (/bridge\/wifi/.test(cmd)) {
        try {
          const d = JSON.parse(out).data;
          const freq = d.frequency_mhz > 5000 ? 'cinco gigahertz' : 'dois ponto quatro gigahertz';
          const sinal = d.rssi > -50 ? 'excelente' : d.rssi > -70 ? 'bom' : 'fraco';
          return `${n}: Wi-Fi ${d.ssid}, ${freq}, sinal ${sinal}`;
        } catch(e) {}
      }
      // Diagnostico GPS/Location
      if (/bridge\/location/.test(cmd)) {
        try {
          const d = JSON.parse(out).data;
          const lat = parseFloat(d.latitude).toFixed(4);
          const lng = parseFloat(d.longitude).toFixed(4);
          return `${n}: localização obtida, latitude ${lat}, longitude ${lng}`;
        } catch(e) {}
      }
      // Health check MCP
      if (/health/.test(cmd) && out.includes('version')) {
        try {
          const d = JSON.parse(out);
          return `${n}: servidor MCP versão ${d.version} online, ${d.activeSessions} sessões ativas`;
        } catch(e) {}
      }
      // Memoria RAM (free -m)
      if (/free -m/.test(cmd)) {
        try {
          const d = JSON.parse(out);
          const pct = Math.round(d.used / d.total * 100);
          return `${n}: memória ${d.used} de ${d.total} megabytes em uso, ${pct} por cento`;
        } catch(e) {
          // fallback para output texto padrao do free
          const lines = out.split('
');
          const memLine = lines.find(l => l.startsWith('Mem:'));
          if (memLine) {
            const parts = memLine.split(/\s+/);
            const total = parseInt(parts[1]);
            const used  = parseInt(parts[2]);
            if (total && used) {
              const pct = Math.round(used / total * 100);
              return `${n}: memória ${used} de ${total} megabytes em uso, ${pct} por cento`;
            }
          }
        }
      }
      // Disco (df -h)
      if (/df -h/.test(cmd)) {
        try {
          const lines = out.split('
');
          const sdcard = lines.find(l => l.includes('/storage/emulated') || l.includes('/sdcard'));
          const internal = lines.find(l => l.match(/\s\/\s*$/));
          const target = sdcard || internal;
          if (target) {
            const parts = target.split(/\s+/);
            return `${n}: disco ${parts[4] || '?'} usado de ${parts[1] || '?'} total, ${parts[3] || '?'} livres`;
          }
        } catch(e) {}
      }
      // Processos ativos (ps aux)
      if (/ps aux/.test(cmd) || /ps -e/.test(cmd)) {
        const lines = out.split('
').filter(l => l.trim());
        const count = Math.max(0, lines.length - 1); // exclui header
        return `${n}: ${count} processos ativos no sistema`;
      }
      // Git commit
      if (/git.*commit/.test(cmd) && out.length > 0) {
        // Tenta extrair hash curto
        const hashMatch = out.match(/\[.*?\s+([a-f0-9]{6,8})\]/);
        const hash = hashMatch ? ` ${hashMatch[1]}` : '';
        return `${n}: commit${hash} realizado com sucesso`;
      }
      // Git push
      if (/git.*push/.test(cmd)) {
        return `${n}: código enviado ao GitHub com sucesso`;
      }
      // Git diff — conta mudancas
      if (/git.*diff/.test(cmd)) {
        const adds = (out.match(/^\+/gm) || []).length;
        const dels = (out.match(/^-/gm) || []).length;
        if (adds || dels) return `${n}: ${adds} linhas adicionadas, ${dels} removidas`;
        return `${n}: sem diferenças encontradas`;
      }
      // Git log — quantos commits
      if (/git.*log/.test(cmd)) {
        const commits = (out.match(/^commit /gm) || []).length;
        if (commits) return `${n}: ${commits} commits encontrados no histórico`;
        return null;
      }
      // Git status — resumo
      if (/git.*status/.test(cmd)) {
        if (out.includes('nothing to commit')) return `${n}: repositório limpo, sem alterações pendentes`;
        if (out.includes('modified')) {
          const mods = (out.match(/modified:/g) || []).length;
          return `${n}: ${mods} arquivo${mods !== 1 ? 's' : ''} modificado${mods !== 1 ? 's' : ''} pendente${mods !== 1 ? 's' : ''}`;
        }
        return null;
      }
      // npm install
      if (/npm.*install/.test(cmd) && result.success) {
        const pkgs = out.match(/(\d+) packages/);
        return pkgs ? `${n}: ${pkgs[1]} pacotes instalados com sucesso` : `${n}: dependências instaladas com sucesso`;
      }
      // npm run — script concluído
      if (/npm.*run/.test(cmd) && result.success) {
        return `${n}: script npm concluído com sucesso`;
      }
      // python3
      if (/python3?/.test(cmd) && result.success && out.length < 200) {
        return out.length > 0 ? `${n}: Python concluído — ${out.slice(0,80)}` : `${n}: script Python executado com sucesso`;
      }
      // Servidor iniciado
      if (/node.*server|node.*mcp/.test(cmd) && result.success) {
        return `${n}: servidor iniciado com sucesso`;
      }
      // Silencia resultados sem stdout relevante
      return null;
    }
    case 'read_file':
      // Só narra read_file se for leitura relevante (não polui com cada leitura)
      if ((action.path||'').includes('README'))    return `${n}: diretivas do sistema carregadas`;
      if ((action.path||'').includes('system_prompt')) return `${n}: protocolo operacional carregado`;
      return null; // leituras genéricas: silencioso
    case 'create_file':
      if ((action.path||'').includes('Memoria-RAG')) return `${n}: memória gravada com sucesso`;
      if ((action.path||'').includes('04_Diario'))  return `${n}: diário atualizado`;
      if ((action.path||'').includes('03_Tarefas')) return `${n}: kanban atualizado`;
      return `${n}: arquivo criado com sucesso`;
    case 'append_file':
      return `${n}: atualização concluída`;
    case 'delete_file':
      return `${n}: arquivo removido com sucesso`;
    case 'move_file':
      return `${n}: arquivo movido com sucesso`;
    case 'search_files': {
      const count = (result.matches || []).length;
      return count > 0
        ? `${n}: busca concluída, ${count} arquivo${count !== 1 ? 's' : ''} encontrado${count !== 1 ? 's' : ''}`
        : `${n}: nenhum arquivo encontrado para a busca`;
    }
    case 'index_cerebro':
      return `${n}: reindexacao concluída`;
    default:
      return null;
  }
}

/**
 * Dispara narração PRE-acao. Chamado antes de executar.
 */
function narrateAction(iaName, action) {
  const text = buildPreNarration(iaName, action);
  ttsSpeak(iaName, text);
}

/**
 * Dispara narração POS-acao com resultado real. Chamado apos executar.
 */
function narrateResult(iaName, action, result) {
  const text = buildPostNarration(iaName, action, result);
  ttsSpeak(iaName, text);
}

export async function processAgentAction(action, iaName = 'workspace') {
    // Registro determinístico em log para auditoria posterior
    const logPath = path.join(WORKSPACE_ROOT, 'Logs', 'executor-audit.log');
    
    // Assegura que o diretório de logs exista
    if (!fs.existsSync(path.dirname(logPath))) {
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
    }

    fs.appendFileSync(logPath, `[${new Date().toISOString()}] [${iaName}] Executando: ${action.type}\n`, 'utf8');

    // TTS NARRATOR — disparo automático obrigatório
    narrateAction(iaName, action);

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
        // Helper: narra resultado e retorna — garante que narrateResult SEMPRE dispara
        const narrate = (result) => { narrateResult(iaName, action, result); return result; };

        switch (action.type) {
            case "create_file": {
                verifyBiometricRequirement(action);
                const securePath = validateAndResolvePath(action.path);
                fs.mkdirSync(path.dirname(securePath), { recursive: true });
                fs.writeFileSync(securePath, action.content, 'utf8');
                return narrate({ success: true, detail: `Arquivo persistido em: ${action.path}` });
            }
            case "read_file": {
                const securePath = validateAndResolvePath(action.path);
                if (!fs.existsSync(securePath)) {
                    return narrate({ success: false, error: "Arquivo não encontrado." });
                }
                const content = fs.readFileSync(securePath, 'utf8');
                return narrate({ success: true, content: content });
            }
            case "append_file": {
                verifyBiometricRequirement(action);
                const securePath = validateAndResolvePath(action.path);
                if (!fs.existsSync(securePath)) {
                    return narrate({ success: false, error: "Arquivo não encontrado." });
                }
                fs.appendFileSync(securePath, action.content, 'utf8');
                return narrate({ success: true, detail: `Conteúdo adicionado ao arquivo: ${action.path}` });
            }
            case "list_dir": {
                const securePath = validateAndResolvePath(action.path);
                if (!fs.existsSync(securePath)) {
                    return narrate({ success: false, error: "Diretório não encontrado." });
                }
                const dirents = fs.readdirSync(securePath, { withFileTypes: true });
                const files = dirents.map(dirent => ({
                    name: dirent.name,
                    isDirectory: dirent.isDirectory(),
                }));
                return narrate({ success: true, files: files });
            }
            case "run_command": {
                verifyCommandSafety(action.command);
                verifyBiometricRequirement(action);
                const { stdout, stderr } = await execPromise(action.command, {
                    cwd: WORKSPACE_ROOT,
                    timeout: 60000, // Timeout hard de 60 segundos por instrução
                    maxBuffer: 1024 * 1024 * 10 // Alocação máxima de 10MB para stdout
                });
                return narrate({
                    success: true,
                    stdout: stdout.toString(),
                    stderr: stderr.toString()
                });
            }
            case "delete_file": {
                verifyBiometricRequirement(action);
                const securePath = validateAndResolvePath(action.path);
                if (!fs.existsSync(securePath)) {
                    return narrate({ success: false, error: "Arquivo nao encontrado." });
                }
                const stat = fs.statSync(securePath);
                if (stat.isDirectory()) {
                    return narrate({ success: false, error: "Para deletar diretorios, remova seus arquivos individualmente." });
                }
                fs.unlinkSync(securePath);
                return narrate({ success: true, detail: `Arquivo removido com sucesso: ${action.path}` });
            }
            case "move_file": {
                const secureSource = validateAndResolvePath(action.source);
                const secureDest = validateAndResolvePath(action.destination);
                if (!fs.existsSync(secureSource)) {
                    return narrate({ success: false, error: "Arquivo ou diretorio de origem nao encontrado." });
                }
                fs.mkdirSync(path.dirname(secureDest), { recursive: true });
                fs.renameSync(secureSource, secureDest);
                return narrate({ success: true, detail: `Movido com sucesso de ${action.source} para ${action.destination}` });
            }
            case "file_info": {
                const securePath = validateAndResolvePath(action.path);
                if (!fs.existsSync(securePath)) {
                    return narrate({ success: false, error: "Arquivo ou diretorio nao encontrado." });
                }
                const stat = fs.statSync(securePath);
                return narrate({
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
                });
            }
            case "search_files": {
                const securePath = validateAndResolvePath(action.path);
                if (!fs.existsSync(securePath)) {
                    return narrate({ success: false, error: "Diretorio inicial nao encontrado." });
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
                return narrate({ success: true, matches: matches });
            }
            // ==========================================
            // NOVAS OPERAÇÕES: RAG SOBERANO
            // ==========================================
            case "index_cerebro": {
                const { indexCerebro } = await import('./vector_db.js');
                const indexResult = await indexCerebro();
                return narrate({ success: true, detail: `Indexação concluída.`, stats: indexResult });
            }
            case "semantic_search": {
                if (!action.query) {
                    return narrate({ success: false, error: "Parâmetro 'query' é obrigatório para busca semântica." });
                }
                const topK = action.top_k || 5;
                const { search } = await import('./vector_db.js');
                const searchResult = await search(action.query, topK);
                return narrate(searchResult);
            }
            default:
                return narrate({ success: false, error: `Operação binária '${action.type}' não homologada.` });
        }
    } catch (err) {
        fs.appendFileSync(logPath, `[ERROR - ${new Date().toISOString()}] Falha: ${err.message}\n`, 'utf8');
        const errResult = { success: false, error: err.message };
        narrateResult(iaName, action, errResult);
        return errResult;
}
