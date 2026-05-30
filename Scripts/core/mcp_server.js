import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { processAgentAction } from "./executor.js";
import { requireAuth } from "./auth_middleware.js";

// Carrega as variáveis de ambiente (API_KEY, NGROK_MODE, etc)
dotenv.config({ path: path.join('/storage/emulated/0/Workspace', 'Projetos', 'telegram_bot', '.env') });

const app = express();

const startTime = Date.now();
const metrics = {
  totalActionsExecuted: 0,
  successfulActions: 0,
  failedActions: 0,
  totalConnections: 0,
  activeConnections: 0,
};

const activeSessions = new Map();

function createMCPServerInstance() {
  const server = new Server(
    {
      name: "workspace-executor-mcp",
      version: "2.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "execute_workspace_action",
          description: "Executa comandos ou cria arquivos no Workspace Mobile via JSON unificado.",
          inputSchema: {
            type: "object",
            properties: {
              payload: {
                type: "object",
                description: "JSON contendo o array 'actions'.",
                properties: {
                  actions: {
                    type: "array",
                    items: {
                      type: "object"
                    }
                  }
                },
                required: ["actions"]
              }
            },
            required: ["payload"],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "execute_workspace_action") {
      const payload = request.params.arguments.payload;
      const results = [];
      
      for (const action of payload.actions) {
        metrics.totalActionsExecuted++;
        try {
          const result = await processAgentAction(action);
          results.push(result);
          if (result.success) {
            metrics.successfulActions++;
          } else {
            metrics.failedActions++;
          }
        } catch (err) {
          metrics.failedActions++;
          results.push({ success: false, error: err.message });
        }
      }
      
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    }
    throw new Error("Tool not found");
  });

  return server;
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    version: "2.1.0",
    uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    metrics: metrics,
    activeSessions: activeSessions.size,
  });
});

// Endpoint SSE protegido por auth_middleware
app.get("/sse", requireAuth, async (req, res) => {
  metrics.totalConnections++;
  metrics.activeConnections++;
  console.log(`[SSE] Nova conexão (#${metrics.totalConnections}). Ativas: ${metrics.activeConnections}`);

  const server = createMCPServerInstance();
  const transport = new SSEServerTransport("/messages", res);

  activeSessions.set(transport.sessionId, { server, transport });

  res.on("close", () => {
    metrics.activeConnections--;
    activeSessions.delete(transport.sessionId);
    console.log(`[SSE] Conexão encerrada. Ativas: ${metrics.activeConnections}`);
    server.close().catch(() => {});
  });

  await server.connect(transport);
});

app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  const session = activeSessions.get(sessionId);

  if (session) {
    await session.transport.handlePostMessage(req, res);
  } else {
    res.status(400).json({ error: "Sessão não encontrada. Reconecte via /sse." });
  }
});

const PORT = 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor MCP v2.1.0 (Com Segurança) rodando na porta ${PORT}!`);
  if (process.env.NGROK_MODE === 'true') {
    console.log(`[ALERTA] Ngrok Mode ATIVADO. Todas as conexões exigem Bearer Token!`);
  } else {
    console.log(`[ALERTA] Ngrok Mode desativado. Conexão local (ADB) aberta sem token.`);
  }
});