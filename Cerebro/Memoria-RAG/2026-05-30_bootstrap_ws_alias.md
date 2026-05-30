# Bootstrap do Workspace — 2026-05-30
**Projeto:** Bootstrap + Alias de serviços

## O que foi feito
- Criado `Scripts/bootstrap/03_start_services.sh` — script mestre que sobe llama-server, Agente Local, MCP Server e Bot Telegram na ordem correta com health checks
- Adicionados aliases no `~/.bashrc`: `ws`, `ws-status`, `ws-restart`, `ws-logs`, `ws-agent`, `ws-bot`
- Corrigido `remote_monitor_and_generate.sh` para usar endpoint llama-server (`/v1/chat/completions`)

## Comandos do dia a dia
```bash
ws             # sobe tudo (idempotente — não duplica)
ws-status      # checa saúde de todos os serviços
ws-restart     # mata e reinicia tudo (quando algo travar)
ws-logs        # tail do llama-server
ws-agent       # tail do agente local
ws-bot         # tail do bot telegram
```

## Comportamento do script
- Idempotente: se o serviço já está ativo, pula sem duplicar
- Ordem de subida: llama-server (1) → agente (2) → mcp_server (3) → bot (4)
- Health check real por porta após cada subida (não apenas PID)
- API REST (4000) é opcional — [!!] amarelo, não erro fatal

## Pendências
- [ ] Milestone 4: app React Native
- [ ] Git: commit de todas as mudanças da sessão

## Palavras-chave
#bootstrap #ws #alias #llama-server #estabilidade #produtividade