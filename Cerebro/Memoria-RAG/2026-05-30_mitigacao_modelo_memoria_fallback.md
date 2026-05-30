# Mitigação: saturação de memória em inferência e fallback (30/05/2026)

Resumo
- Sintoma: requisição a `/api/generate` falhando intermitentemente com HTTP 500 (~54s).
- Causa provável: saturação de memória/RAM durante carregamento/inferência do modelo `llama3.2:1b` em dispositivo com ~3.7 GiB (swap alto, uso de RAM elevado), alcançando latências próximas ao timeout do executor (60s).

Ações executadas
- Coleta centralizada de logs: `Scripts/core/collected_executor_audit_raw.log`, `resposta da IA (logs) e telegram.txt`, `Logs/ollama_server.log`.
- Reproduzi a chamada `/api/generate` localmente e confirmei streaming NDJSON quando servidor `ollama serve` estava ativo.
- Implementado e testado `Scripts/core/mcp_generate_with_fallback.mjs`:
  - Verifica memória disponível (`free -m`).
  - Ajusta `max_tokens` para 256 se disponível < 700 MB, caso contrário usa 1024.
  - Tenta gerar localmente em `http://127.0.0.1:11434` com timeout seguro; captura saída.
  - Se falha e houver variables `CLAUDE_API_URL` + `CLAUDE_API_KEY` no dispositivo, faz fallback para Claude.

Resultados
- Testes mostraram geração bem-sucedida localmente com token streaming; em condições de baixa memória o wrapper reduz tokens para evitar OOM/timeouts.

Recomendações e próximos passos
- Integrar o wrapper `mcp_generate_with_fallback.mjs` nas rotinas de geração existentes (scripts e chamadas automatizadas). Opções:
  1) Substituir chamadas `curl` diretas por invocações ao wrapper (rápido, menos invasivo).
  2) Refatorar clientes para chamar uma função JS comum (mais limpo, requer modificar múltiplos pontos).
- Tunar Ollama (definitivo): ajustar `OLLAMA_NUM_PARALLEL=1`, reduzir threads/KV cache, ou usar modelo menor por padrão.
- Monitoramento: alertas para memória disponível < 700 MB e fallback automático.

Referências
- Scripts adicionados/alterados: `Scripts/core/mcp_generate_with_fallback.mjs`, `Scripts/core/mcp_read_executor_log.mjs`, `Scripts/core/mcp_repro_generate.mjs`, `Scripts/core/collected_executor_audit_raw.log`.

Autor: Automação MCP (por ordem do operador)
Data: 2026-05-30
