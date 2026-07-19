# Chronos-VPS

Migração do assistente pessoal "Chronos" (antes rodando 100% em Android/Termux)
para uma VPS Linux. Veja `ARCHITECTURE.md` para o diagrama completo e
`JULES_BRIEFING.md` para a lista de tarefas de implementação/validação.

## Quick start (Docker)

```bash
cp .env.example .env
# edite .env com sua API_SECRET_KEY, TELEGRAM_BOT_TOKEN, etc.

# baixe um modelo GGUF antes do primeiro start (ver JULES_BRIEFING.md, Tarefa 2)
mkdir -p llm/models

docker compose build
docker compose up -d
docker compose ps   # todos devem ficar "healthy"
```

## Alternativa sem Docker (systemd)

Os arquivos em `systemd/` são unidades prontas para uma instalação direta na VPS
(sem containers) — útil se preferir menos overhead. Copie para
`/etc/systemd/system/`, ajuste os paths de `WorkingDirectory` para onde você
efetivamente instalou o projeto (sugestão: `/opt/chronos-vps`), e:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now chronos-llm chronos-mcp chronos-bot chronos-hub
```

## Estrutura

```
chronos-vps/
├── docker-compose.yml       # orquestração completa
├── Caddyfile                # HTTPS automático (substitui Serveo/ngrok)
├── .env.example
├── llm/                     # servidor do modelo local (llama.cpp)
├── mcp-server/              # núcleo: MCP, executor, dispatch, RAG
├── telegram-bot/            # interface principal do usuário
├── hub-pwa/                 # painel de controle web
├── scripts/                 # utilitários (tech_scraper.py etc.)
├── cerebro/                 # vault Obsidian (governança + memória RAG)
├── systemd/                 # unidades para instalação sem Docker
├── ARCHITECTURE.md
└── JULES_BRIEFING.md        # tarefas de implementação para o Google Jules
```

## Status

Scaffold gerado a partir do código original do repositório Android
(`guilhermepedru02-ship-it/mobile`). Caminhos hardcoded do Android já foram
generalizados via variáveis de ambiente (`WORKSPACE_ROOT`), mas o conjunto
**ainda não foi testado em execução real** — essa é a Tarefa 1 do
`JULES_BRIEFING.md`.
