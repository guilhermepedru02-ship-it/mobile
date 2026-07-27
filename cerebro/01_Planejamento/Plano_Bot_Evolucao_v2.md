# Plano: Evolução do Bot Telegram — Chronos v2
**Data:** 2026-05-28
**Status:** Em Progresso

## Objetivo
Adicionar dois novos comandos ao bot.js e corrigir o /status para monitorar todos os serviços.

## Etapas
1. [x] Ler bot.js atual para base de implementação
2. [x] Implementar /tarefa — escreve nova tarefa no Backlog do kanban.md
3. [x] Implementar /ia — envia pergunta à API da Anthropic e responde no Telegram
4. [x] Corrigir /status — adicionar verificação da porta 4000 (API REST)
5. [x] Atualizar menu do /start com os novos comandos
6. [x] Registrar no diário e atualizar Kanban

## Riscos
- /ia depende de ANTHROPIC_API_KEY no .env — documentar no .env.example
- Respostas longas da IA podem exceder limite de 4096 chars do Telegram — truncar com aviso

## Resultado Esperado
bot.js v2 salvo em Projetos/telegram_bot/bot.js com os 3 novos comportamentos funcionais.
