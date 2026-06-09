const fs = require('fs');
const REGISTRY = '/storage/emulated/0/Workspace/Scripts/core/tool_registry.json';

const reg = JSON.parse(fs.readFileSync(REGISTRY, 'utf8'));

const newTools = [
  {
    id: 'channel_read',
    description: 'Le o canal inter-IA (multiia_channel.md). Qualquer IA pode ler para ver estado da colaboracao, thread ativa e historico.',
    requires_biometric: false,
    trigger_keywords: [
      'canal multi-ia', 'canal ia', 'ler canal', 'le canal', 'ver canal',
      'multiia channel', 'thread ativa', 'colaboracao ia', 'canal colaboracao',
      'o que antigravity disse', 'o que claude disse', 'historico ia'
    ],
    type: 'read_file',
    path: 'Cerebro/01_Planejamento/multiia_channel.md',
    output: 'markdown'
  },
  {
    id: 'channel_write',
    description: 'Escreve timestamp + mensagem no canal inter-IA. Lock otimista 30s. Use para coordenacao entre IAs.',
    requires_biometric: false,
    trigger_keywords: [
      'escrever canal', 'escreve canal', 'postar canal', 'mensagem canal',
      'channel write', 'publicar canal', 'enviar canal ia'
    ],
    type: 'run_command',
    command: "echo '[CANAL] Mensagem registrada'",
    output: 'text',
    note: 'Para mensagens customizadas, use append_file diretamente com texto formatado.'
  },
  {
    id: 'mcp_sessions',
    description: 'Lista IAs conectadas ao MCP no momento via /mcp/sessions. Detecta presenca de agentes ativos na sessao.',
    requires_biometric: false,
    trigger_keywords: [
      'ias conectadas', 'quem esta conectado', 'sessoes mcp', 'agentes ativos',
      'mcp sessions', 'ias ativas', 'quem ta online', 'presenca ia',
      'antigravity conectado', 'claude conectado', 'manus conectado'
    ],
    type: 'run_command',
    command: "curl -s --max-time 3 http://127.0.0.1:3001/mcp/sessions 2>/dev/null || echo '{}'" ,
    output: 'json'
  }
];

reg.tools.push(...newTools);
reg.version = '2.9.0';
reg.description = 'Catalogo de ferramentas do Chronos Local v2.9.0 - multi-ia canal + channel tools (TASK-0609-D)';
reg.updated_at = '2026-06-09';

fs.writeFileSync(REGISTRY, JSON.stringify(reg, null, 2));
console.log('OK - version:', reg.version, '| tools:', reg.tools.length);
