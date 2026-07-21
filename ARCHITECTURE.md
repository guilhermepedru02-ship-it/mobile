# Arquitetura — Chronos-VPS

## Visão geral

```
                        ┌─────────────────────────────┐
                        │         Internet             │
                        └──────────────┬───────────────┘
                                       │ HTTPS (443)
                              ┌────────▼────────┐
                              │      Caddy       │  (reverse proxy + TLS automático
                              │  (Let's Encrypt) │   substitui Serveo/ngrok)
                              └───┬──────────┬───┘
                       /sse,/msgs │          │ /* (painel)
                              ┌───▼───┐  ┌───▼──────┐
                              │  MCP  │  │  Hub PWA │
                              │Server │  │  (5555)  │
                              │(3001) │  └──────────┘
                              └──┬─┬──┘
                     ┌───────────┘ └────────────┐
                     │                          │
              ┌──────▼──────┐           ┌───────▼────────┐
              │  LLM local  │           │  Cerebro/      │
              │ llama.cpp   │           │  (vault Obsidian│
              │ (11434)     │           │  + RAG + kanban)│
              └─────────────┘           └───────┬────────┘
                                                  │
                                         ┌────────▼────────┐
                                         │ rag-consolidator │
                                         │  (cron diário)   │
                                         └──────────────────┘

              ┌──────────────┐
              │ Telegram Bot │──── fala com MCP Server e/ou LLM diretamente
              └──────────────┘     (interface principal do usuário)
```

## O que mudou estruturalmente vs. a versão Android/Termux

| Problema no Android | Solução no VPS |
|---|---|
| Phantom Process Killer matando processos em background | Não existe em Linux servidor — processos ficam vivos naturalmente |
| `protect_pid()` escrevendo em `/proc/pid/oom_score_adj` e falhando por EACCES (SELinux) | `OOMScoreAdjust=` no systemd (ou `mem_limit`/restart policy no Docker) — funciona de verdade, sem sandbox restringindo |
| Sessão Termux caindo e derrubando tudo junto (SIGKILL signal9) | Cada serviço é um processo/container isolado com `Restart=always` — um cair não derruba os outros |
| Túnel Serveo/ngrok com link efêmero (`SKILL_restabelecer_conexao.md`) | Domínio fixo + Caddy com HTTPS automático — a URL nunca muda |
| ADB forward (precisa de cabo USB físico) | Acesso direto via internet, de qualquer lugar |
| TTS via `termux-tts-speak` (zumbis, fila, workarounds) | Removido do escopo inicial — pode voltar depois via TTS de nuvem, se quiser |
| `biometric_gate.sh` (fingerprint Android) | Precisa de substituto (ver `JULES_BRIEFING.md`, tarefa 5) |
| Modelo Qwen 2.5 **0.5B** (limite de RAM de celular) | Modelo Qwen 2.5 **7B+** (ou maior, se for pra GPU) |

## Componentes reaproveitados quase 1:1
`mcp_server.js`, `executor.js`, `dispatch.js`, `context_builder.js`, `vector_db.js`,
`consolidate_rag.js`, `working_memory.js`, `tool_registry.json`, o bot do Telegram,
o Hub PWA e o `tech_scraper.py`. A lógica de negócio (RAG, Gatekeeper, roteamento de
intents) é independente de plataforma — só precisava sair do Android.
