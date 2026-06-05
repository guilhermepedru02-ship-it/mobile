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

## [2026-06-02] executor.js: regex fork-bomb causava falso positivo em paths com hífen
**Sintoma:** Intent `listar arquivos do cerebro` roteava correto (`TOOL_CALL → list_cerebro`) mas retornava `source: local` com resposta vazia — executor falhava silenciosamente.
**Causa raiz:** Regex anti-fork-bomb `/:.*\(.*\).*\{.*/` trigava em `Memoria-RAG; do base=...($d)` — a string `Memoria-RAG` contém `:`, loop bash normal contém `(`, `)`, `{`. Falso positivo.
**Fix:** `executor.js` linha 30 — regex corrigido para `/:.*\(\s*\)\s*\{/` (fork bomb real exige `()` adjacente a `{`, sem conteúdo). Comando do `list_cerebro` em `tool_registry.json` reescrito para usar `find ... | python3 -c` eliminando o padrão.
**Diagnóstico:** Sempre checar `executor-audit.log` — registrava `SECURITY ALERT` revelando a causa sem ambiguidade.

## [2026-06-02] hub_pwa: script de boot usava path inexistente
**Sintoma:** Hub PWA nunca subia após `ws` ou restart. Nenhum processo na porta 5555.
**Causa:** `Scripts/bootstrap/03_start_services.sh` tinha `HUB="/data/data/com.termux/files/home/hub_pwa"` — path que não existe. O hub_pwa real está em `/storage/emulated/0/Workspace/Projetos/hub_pwa`.
**Fix:** `sed -i 's|HUB="/data/data/.../hub_pwa"|HUB="/storage/emulated/0/Workspace/Projetos/hub_pwa"|'`
**Lição:** Ao criar novos serviços, verificar imediatamente se o path no script de bootstrap corresponde ao path real de instalação.

## [2026-06-02] hub_pwa app.js: CORS bloqueava chamadas diretas à bridge (porta 4444)
**Sintoma:** Aba Bridge do PWA retornava erros CORS — browser bloqueava requisições de `localhost:5555` para `localhost:4444`.
**Causa:** `app.js` original chamava `http://127.0.0.1:4444/bridge/...` diretamente. Same-origin policy bloqueia mesmo em localhost quando as portas diferem.
**Fix:** `server.js` ganhou rota `POST /proxy/bridge/:action` que faz o proxy server-side. `app.js` v1.0.1 passou a chamar `/proxy/bridge/...` (mesmo origin 5555→5555). Idem para `/proxy/bridge/audit` (GET).

## [2026-06-03] hub_pwa app.js: SSID exibido como "<unknown ssi" (truncado)
**Sintoma:** Card Wi-Fi do Painel mostrava `<unknown ssi` em vez do nome da rede.
**Causa:** Dois fatores combinados: (1) `d.ssid.substring(0, 12)` truncava qualquer SSID a 12 chars. (2) Android retorna `<unknown ssid>` para processos Node.js em background no boot, antes da stack de rede completar — não é problema de permissão de localização.
**Fix (app.js v1.0.2 → v1.0.3):** Removida truncagem. Quando `ssid === '<unknown ssid>'` → exibe `rede Wi-Fi` no título e IP normal no subtítulo (sem hint enganoso sobre localização).
**Importante:** Termux:API com `ACCESS_FINE_LOCATION` concedida retorna o SSID correto em sessão interativa. O `<unknown ssid>` ocorre especificamente quando o processo Node.js sobe antes da rede estar pronta.

## [2026-06-03] pip3: falha ao instalar pacotes C-extension no Termux
**Sintoma:** `pip3 install numpy` / `pip3 install Pillow` falham com erro de compilação (gcc/wheel).
**Causa:** Termux não possui toolchain C completo acessível ao pip. Pacotes que precisam compilar extensões nativas falham.
**Solução permanente:** `pkg install python-<nome>` para C-extensions. `pip3 install` funciona normalmente para pure Python.
**Pacotes resolvidos via pkg (2026-06-03):** python-numpy (2.4.4), python-pillow (12.2.0), python-scipy (1.17.1).
