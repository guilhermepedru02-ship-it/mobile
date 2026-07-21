# Chronos-VPS — MCP Server (núcleo: executor, dispatch, RAG, tool_registry)
FROM node:20-slim

# ferramentas de shell usadas pelo executor.js (git, curl, python p/ index_cerebro.py)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY . .

RUN mkdir -p /app/cerebro-root

EXPOSE 3001

HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "mcp_server.js"]
