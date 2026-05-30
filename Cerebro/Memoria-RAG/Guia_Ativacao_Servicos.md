# Guia Definitivo de Ativação de Serviços
*Este documento é uma referência rápida para inicializar todos os subsistemas do Workspace no Termux.*

## 1. MCP Server (Núcleo de IA)
Responsável por conectar o celular a IAs avançadas (Antigravity IDE, Claude Desktop) via USB (porta 3001).
**Diretório de execução:** `Workspace/Scripts/core`
**Comandos:**
```bash
cd /storage/emulated/0/Workspace/Scripts/core
npm start
# ou
node mcp_server.js
```

## 2. Bot do Telegram (Chronos)
Sua interface de comando remoto (Gatekeeper). Processa `/noticias`, `/tarefas`, `/status` e lê o `.env`.
**Diretório de execução:** `Workspace/Projetos/telegram_bot`
**Comandos:**
```bash
cd /storage/emulated/0/Workspace/Projetos/telegram_bot
node bot.js
```

## 3. API REST (Automações e Scripts)
Responsável por expor endpoints HTTP na porta 4000 (requer `Bearer Token`).
**Diretório de execução:** `Workspace/Scripts/core`
**Comandos:**
```bash
cd /storage/emulated/0/Workspace/Scripts/core
node api_rest.js
```

## 4. Túneis de Exposição (Acesso Externo)
Expõe o MCP e/ou a API REST para a internet via HTTPS (Serveo/SSH). 
*O script liga e desliga o `NGROK_MODE` no `.env` automaticamente!*
**Diretório de execução:** `Workspace`
**Comandos:**
```bash
cd /storage/emulated/0/Workspace

# Expor APENAS o MCP Server (para IAs externas na nuvem)
bash Scripts/ngrok/start_tunnel.sh mcp

# Expor APENAS a API REST (para integrações Zapier/n8n)
bash Scripts/ngrok/start_tunnel.sh api

# Expor AMBOS simultaneamente
bash Scripts/ngrok/start_tunnel.sh both
```
*(Para encerrar o túnel com segurança, pressione **Ctrl+C**).*

---

### 💡 Dica de Ouro: Como rodar tudo junto no Termux?
Como os serviços rodam continuamente, você precisa de **Sessões Múltiplas**.
No aplicativo do Termux, deslize o dedo da **borda esquerda da tela para a direita** para abrir o menu lateral e clique em **"New session"**.
- Sessão 1: Rode o `mcp_server.js`
- Sessão 2: Rode o `bot.js` do Telegram
- Sessão 3: Rode o `start_tunnel.sh` (se for usar acesso externo)