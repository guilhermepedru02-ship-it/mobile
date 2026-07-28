# Resumo da Sessão — 2026-05-30
**Duração aproximada:** ~40 ações executadas
**Projeto:** Migração LLM + Estabilização Pipeline IA Local

## O que foi feito
- Diagnóstico completo do sistema antes de qualquer mudança (RAM, processos, storage)
- Remoção cirúrgica do Ollama binário + modelo llama3.2:1b (~1.37GB liberados)
- Instalação do llama-cpp via pkg (llama-server)
- Download do Qwen 2.5 0.5B Q4_K_M (469MB) via wget com retry
- Migração da API: Ollama `/api/generate` → llama-server `/v1/chat/completions` (OpenAI-compat)
- Atualização cirúrgica de `ollama_agent.js` e `mcp_generate_with_fallback.mjs`
- Criação de `start_llama_server.sh` — script de inicialização padronizado
- Correção de contexto: ctx-size 512 → 1024 (prompt enriquecido excedia limite)
- Auto-desbloqueio do Gatekeeper no startup do ollama_agent.js
- Otimização de tokens: RAG condicional + toolOutput truncado a 200 chars
- Pipeline validado end-to-end: bot.js → 4001/agent → llama-server → resposta

## Decisões tomadas
- **llama-server no lugar do Ollama:** mesmo binário, API OpenAI-compat nativa, sem overhead de daemon
- **ctx-size 1024:** margem suficiente para kanban + system prompt + resposta
- **RAG desabilitado quando há tool result:** evita overflow de contexto, tool result já contém o dado relevante
- **toolOutput truncado a 200 chars:** reduz prefill de 827 → ~280 tokens, latência de 55s → ~12s
- **Auto-unlock Gatekeeper:** agente chama `read_file README.md` no startup; garante que nunca começa bloqueado
- **--no-mmap:** evita swap excessivo no Android, modelo carregado direto na RAM

## Pendências para próxima sessão
- [ ] llama-server não persiste após reboot/kill do Android — adicionar ao bootstrap
- [ ] Milestone 4: iniciar app React Native
- [ ] Git: commit da migração LLM para o repositório remoto

## Palavras-chave
#llama-cpp #qwen #migracao #pipeline #gatekeeper #otimizacao #milestone3-completo