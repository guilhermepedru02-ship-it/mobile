# Erros Conhecidos e Soluções

## npm install falha no /storage/emulated/0/
- **Erro:** EPERM, symlink não suportado
- **Solução:** Usar `npm install --no-bin-links`

## Phantom Process Killer mata o Node.js
- **Erro:** Processo do code-server ou MCP server morre sozinho
- **Solução:** Aplicar `adb shell "settings put global max_phantom_processes 2147483647"`

## SSE "stream is not readable"
- **Erro:** Após conectar via MCP, o POST para /messages retorna HTTP 400
- **Solução:** Remover `app.use(express.json())` do mcp_server.js

## Timeout na conexão Wi-Fi entre PC e celular
- **Erro:** Connect Timeout ao acessar IP do celular na porta 3001
- **Solução:** Usar ADB Forward (`adb forward tcp:3001 tcp:3001`) e conectar via `127.0.0.1`

---

## [2026-05-30] llama-server HTTP 400 com prompt enriquecido
**Sintoma:** `ollama_agent.js` retornava `HTTP 400` ao chamar llama-server após tool result.
**Causa:** ctx-size inicial de 512 tokens era insuficiente para o conjunto system prompt + kanban + RAG (~827 tokens totais).
**Solução:** Aumentar ctx-size para 1024 + desativar RAG quando já há tool result no prompt + truncar toolOutput a 200 chars.

## [2026-05-30] EADDRINUSE na porta 4001 ao reiniciar o agente
**Sintoma:** `Error: listen EADDRINUSE: address already in use 127.0.0.1:4001` ao subir nova instância do ollama_agent.js.
**Causa:** Instância anterior não encerrada antes do restart.
**Solução:** `kill <PID>` da instância antiga antes de subir a nova. Usar `ps aux | grep ollama_agent` para localizar o PID.

## [2026-05-30] llama-server derrubado pelo Android (OOM/kill de sessão)
**Sintoma:** Bot Telegram não responde ao `/local` — agente online mas llama-server morto na porta 11434.
**Causa:** Android mata o processo llama-server quando a sessão Termux perde foco ou há pressão de memória.
**Solução imediata:** Verificar com `curl http://127.0.0.1:11434/health` e reiniciar via `start_llama_server.sh`.
**Solução definitiva pendente:** Adicionar llama-server ao script de bootstrap com `nohup` em sessão dedicada.

## [2026-05-30] Gatekeeper bloqueia ollama_agent.js no startup
**Sintoma:** Primeira chamada ao agente retornava `ACCESS DENIED` do Gatekeeper.
**Causa:** `executor.js` inicia com `hasReadRules = false` a cada novo processo; agente não se auto-desbloqueava.
**Solução:** Adicionado `unlockGatekeeper()` no startup do `ollama_agent.js` — chama `read_file README.md` automaticamente.

## [2026-05-30] Dispatch: substring matching causava falsos positivos
**Sintoma:** "quais ferramentas voce tem" disparava `ram_status` em vez de `list_tools`.
**Causa:** `String.includes()` casa substrings — "fer**ram**entas" contém "ram".
**Solução:** Regex com word-boundary `(^|[\s,!?])keyword([\s,!?]|$)` no dispatch.js.

## [2026-05-30] LLM gerava JSON bruto em vez de linguagem natural
**Sintoma:** Respostas como `{"action":"run_command","command":"..."}`.
**Causa:** system_prompt instruiía a responder com JSON para ações, mas o LLM aplicava isso mesmo na síntese de resultados.
**Solução:** Dois system prompts: SYSTEM_PROMPT (conversa) e SYSTEM_PROMPT_SYNTHESIS (síntese de resultado).
