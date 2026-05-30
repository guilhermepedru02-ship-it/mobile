import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import dotenv from "dotenv";
import path from "path";
import { processAgentAction } from "./executor.js";
import { requireAuth } from "./auth_middleware.js";

// Importar o novo executor de DevTools (opcional se integrarmos no core)
// Para esta implementação, vamos integrar as definições de ferramentas no mcp_server.js
// e deixar que o executor.js (ou o novo devtools-executor) processe.

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
      name: "workspace-dev-agent-mcp",
      version: "2.2.0",
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
                    items: { type: "object" }
                  }
                },
                required: ["actions"]
              }
            },
            required: ["payload"],
          },
        },
        {
          name: "devtools_action",
          description: "Ferramentas avançadas de engenharia (Git, NPM, Python).",
          inputSchema: {
            type: "object",
            properties: {
              action: {
                type: "object",
                properties: {
                  type: { type: "string", enum: ["git_action", "npm_action", "python_exec"] },
                  git_cmd: { type: "string", description: "status, log, add, commit, push, pull" },
                  npm_cmd: { type: "string", enum: ["install", "test", "run", "list"] },
                  script_path: { type: "string" },
                  args: { type: "array", items: { type: "string" } }
                },
                required: ["type"]
              }
            },
            required: ["action"]
          }
        }
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    
    if (name === "execute_workspace_action" || name === "devtools_action") {
      const actions = name === "execute_workspace_action" ? args.payload.actions : [args.action];
      const results = [];
      
      for (const action of actions) {
        metrics.totalActionsExecuted++;
        try {
          // Normalização para o executor
          if (name === "devtools_action") {
            if (action.type === "git_action") action.action = action.git_cmd;
            if (action.type === "npm_action") action.command = action.npm_cmd;
          }
          
          const result = await processAgentAction(action);
          results.push(result);
          if (result.success) metrics.successfulActions++;
          else metrics.failedActions++;
        } catch (err) {
          metrics.failedActions++;
          results.push({ success: false, error: err.message });
        }
      }
      
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    }
    throw new Error("Tool not found");
  });

  return server;
}

// ... (Restante do código app.get/post/listen permanece idêntico ao v2.1.0)
