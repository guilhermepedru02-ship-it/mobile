# Briefing para o Google Jules — Migração Chronos Android → Chronos VPS

## Contexto (cole isso na primeira instrução do Jules)

Este repositório é um scaffold de migração do projeto "Chronos" — um assistente de
IA pessoal que hoje roda 100% em Android/Termux — para uma VPS Linux comum. A
lógica de negócio (MCP server, executor, dispatch de intents, RAG sobre um vault
Obsidian) já foi portada e está nas pastas `mcp-server/`, `telegram-bot/`, `hub-pwa/`,
`cerebro/`. Os arquivos de infraestrutura (`docker-compose.yml`, `Caddyfile`,
Dockerfiles, unidades `systemd/`) já existem, mas **nunca foram testados** —
foram gerados a partir da leitura estática do código antigo, não de uma execução
real. Sua missão é fechar essas lacunas, uma tarefa por vez, testando de verdade
antes de marcar como concluída.

Leia primeiro `ARCHITECTURE.md` (diagrama e tabela "o que mudou") antes de tocar
em qualquer arquivo.

---

## Tarefa 1 — Validar o boot completo via Docker Compose
- `docker compose build && docker compose up -d`
- Corrigir qualquer erro de build (a tag da imagem `ghcr.io/ggml-org/llama.cpp:server`
  em `llm/Dockerfile` é um palpite — confirme a tag real disponível no momento).
- `curl http://localhost:3001/health` e `curl http://localhost:11434/health` devem
  responder 200.
- Critério de aceite: `docker compose ps` mostra todos os serviços `healthy`.

## Tarefa 2 — Baixar e validar um modelo GGUF real
- Baixar `Qwen/Qwen2.5-7B-Instruct-GGUF` (variante `q4_k_m`) para `llm/models/`
  (usar `huggingface-cli` ou `wget` direto do Hugging Face Hub).
- Confirmar que `mcp-server` consegue chamar `http://llm:11434/v1/chat/completions`
  e receber uma resposta coerente via uma chamada de teste simples.
- Se a VPS escolhida pelo usuário tiver GPU, adicionar suporte CUDA na imagem
  (`--n-gpu-layers` > 0 no `CMD` do `llm/Dockerfile`).

## Tarefa 3 — Remover/adaptar tudo que dependia de hardware Android
- Em `mcp-server/tool_registry.json`: remover ou marcar como `disabled` as tools
  que chamavam `android_bridge.js` (battery, wifi, location, sensors, infrared).
  Esse arquivo JS nunca foi portado de propósito — não existe hardware de celular
  na VPS.
- Em `mcp-server/dispatch.js`: remover keywords/rotas que hoje ficam órfãs por
  causa da remoção acima (rode um grep por `bridge` para achar todas).
- Confirmar que `mcp-server/executor.js` não tem nenhuma referência remanescente
  a `termux-*` (rode `grep -rn "termux" mcp-server/`).

## Tarefa 4 — Autenticação HTTPS de verdade
- Editar `Caddyfile`: trocar `chronos.SEUDOMINIO.com` pelo domínio real do usuário
  (ele precisa ter um registro DNS tipo A apontando pro IP da VPS antes disso
  funcionar — não é algo que o Jules resolve sozinho, é decisão do usuário).
- Confirmar que o token do Gatekeeper (`API_SECRET_KEY`) continua sendo exigido
  via query string em `/sse` (ver `auth_middleware.js`) — não perder essa camada
  de segurança na migração.

## Tarefa 5 — Decidir substituto do gate biométrico
- `dispatch.js` hoje tem `BIOMETRIC_GATE = null` (placeholder deixado de propósito).
  Antes de reativar qualquer tool com `requires_biometric: true` no
  `tool_registry.json`, implementar um mecanismo de confirmação equivalente.
  Sugestões, em ordem de esforço: (a) confirmação por botão inline no Telegram
  antes de executar a ação, (b) TOTP/2FA simples, (c) nada — remover o conceito
  se o usuário decidir que não precisa mais dessa camada numa VPS privada.
- **Não prosseguir com essa tarefa sem confirmação explícita do usuário sobre
  qual opção ele prefere.**

## Tarefa 6 — Cron de consolidação do RAG
- O serviço `rag-consolidator` no `docker-compose.yml` faz `sleep 86400` em loop
  — funcional, mas rústico. Trocar por um cron real dentro do container (ex:
  `supercronic` ou `cron` do próprio Debian) para permitir horários configuráveis,
  igual ao `0 23 * * *` que existia no Termux.

## Tarefa 7 — Sincronização do vault Cerebro com o Obsidian do usuário
- Hoje `cerebro/` é só uma cópia estática enviada neste scaffold. Definir e
  documentar em `README.md` o método de sincronização contínua entre o vault
  local (onde o usuário edita no PC/celular com o app Obsidian) e o volume da
  VPS: opções incluem Syncthing, `git pull` periódico, ou Obsidian Sync pago.
  Não implemente sem antes confirmar qual opção o usuário prefere.

## Tarefa 8 — Testes de fumaça end-to-end
- Enviar uma mensagem de teste ao bot do Telegram e confirmar que ela percorre
  o caminho completo: bot → mcp-server → dispatch → executor/LLM → resposta.
- Testar `list_tools` via MCP para confirmar que o `tool_registry.json` limpo
  (Tarefa 3) ainda expõe corretamente as tools válidas.
- Documentar os resultados em `cerebro/02_Memoria/decisoes_tecnicas.md`, seguindo
  o mesmo padrão de entradas datadas já usado no projeto original.

## Regras gerais para o Jules
- Não commitar `.env` nunca — só `.env.example` (o `.gitignore` deste repo já
  bloqueia isso, mantenha).
- Sempre que um passo exigir uma decisão de produto (domínio, provedor de VPS,
  substituto do gate biométrico, método de sync do Obsidian), **pare e pergunte**
  em vez de assumir.
- Ao final de cada tarefa, rodar os healthchecks antes de marcar como concluída.
