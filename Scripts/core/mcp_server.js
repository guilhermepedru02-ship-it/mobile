import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { processAgentAction } from "./executor.js";
import { requireAuth } from "./auth_middleware.js";

dotenv.config({ path: path.join('/storage/emulated/0/Workspace', 'Projetos', 'telegram_bot', '.env') });
dotenv.config({ path: '/storage/emulated/0/Workspace/Scripts/core/.env', override: false });

const app = express();

const startTime = Date.now();
const metrics = {
  totalActionsExecuted: 0,
  successfulActions: 0,
  failedActions: 0,
  totalConnections: 0,
  activeConnections: 0,
};

// Mapa sessionId -> transport (para roteamento de POST /messages)
const activeSessions = new Map();

// ==============================================================================
// INSTÂNCIAS FIXAS POR IA — uma por identidade, reutilizadas entre reconexões
// IAs externas via SSE/MCP: Claude, Antigravity, Manus
// Qwen é IA local (llama-server porta 11434) — não usa SSE/MCP
// Benefício: elimina vazamento de listeners Node.js causado por
// createMCPServerInstance() a cada reconexão (causa raiz do signal9/OOM)
// ==============================================================================
function buildMCPServer(iaName) {
  const server = new Server(
    { name: "workspace-executor-mcp", version: "2.4.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [{
      name: "execute_workspace_action",
      description: "Executa comandos ou cria arquivos no Workspace Mobile via JSON unificado.",
      inputSchema: {
        type: "object",
        properties: {
          payload: {
            type: "object",
            description: "JSON contendo o array 'actions'.",
            properties: {
              actions: { type: "array", items: { type: "object" } }
            },
            required: ["actions"]
          }
        },
        required: ["payload"],
      },
    }],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "execute_workspace_action") {
      const payload = request.params.arguments.payload;
      const results = [];
      for (const action of payload.actions) {
        metrics.totalActionsExecuted++;
        try {
          const result = await processAgentAction(action, iaName);
          results.push(result);
          result.success ? metrics.successfulActions++ : metrics.failedActions++;
        } catch (err) {
          metrics.failedActions++;
          results.push({ success: false, error: err.message });
        }
      }
      return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
    }
    throw new Error("Tool not found");
  });

  return server;
}

// Instâncias singleton — criadas uma vez, nunca recriadas
const IA_SERVERS = {
  Claude:      buildMCPServer('Claude'),
  Antigravity: buildMCPServer('Antigravity'),
  Manus:       buildMCPServer('Manus'),
  workspace:   buildMCPServer('workspace'),  // retrocompatibilidade /sse legado
};

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    version: "2.4.0",
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    metrics,
    activeSessions: activeSessions.size,
  });
});

// ==============================================================================
// HANDLER SSE — reutiliza Server singleton, cria apenas novo Transport por conexão
// Isso elimina o vazamento de listeners que causava o OOM/signal9
// ==============================================================================
async function handleSseConnection(req, res, iaName) {
  metrics.totalConnections++;
  metrics.activeConnections++;
  console.log(`[SSE][${iaName}] Nova conexao (#${metrics.totalConnections}). Ativas: ${metrics.activeConnections}`);

  const server = IA_SERVERS[iaName];
  const transport = new SSEServerTransport("/messages", res);

  activeSessions.set(transport.sessionId, transport);

  res.on('close', () => {
    metrics.activeConnections--;
    activeSessions.delete(transport.sessionId);
    console.log(`[SSE][${iaName}] Conexao encerrada. Ativas: ${metrics.activeConnections}`);
    // NÃO fecha o server — ele é singleton e será reutilizado na próxima conexão
  });

  await server.connect(transport);
}

// Rotas SSE — apenas IAs externas que realmente usam MCP
app.get('/sse/claude',      requireAuth, (req, res) => handleSseConnection(req, res, 'Claude'));
app.get('/sse/antigravity', requireAuth, (req, res) => handleSseConnection(req, res, 'Antigravity'));
app.get('/sse/manus',       requireAuth, (req, res) => handleSseConnection(req, res, 'Manus'));
// Retrocompatibilidade: /sse legado
app.get('/sse',             requireAuth, (req, res) => handleSseConnection(req, res, 'workspace'));

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = activeSessions.get(sessionId);
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).json({ error: "Sessão não encontrada. Reconecte via /sse." });
  }
});

const PORT = 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor MCP v2.4.0 (Singleton + Anti-OOM) rodando na porta ${PORT}!`);
  if (process.env.NGROK_MODE === 'true') {
    console.log(`[ALERTA] Ngrok Mode ATIVADO. Todas as conexoes exigem Bearer Token!`);
  } else {
    console.log(`[ALERTA] Ngrok Mode desativado. Conexao local (ADB) aberta sem token.`);
  }
  console.log(`[INFO] Instancias MCP pre-alocadas: Claude, Antigravity, Manus, workspace`);
});
