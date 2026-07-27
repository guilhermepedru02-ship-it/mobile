# 2026-06-02 — Estabilização Mestre do Workspace Mobile

**Data:** 02/06/2026  
**Sessões envolvidas:** 2 (diagnóstico + execução dos fixes)  
**IAs:** Claude Sonnet 4.6 (externa via MCP) + Qwen 2.5 0.5B (local)  
**Status final:** ✅ Sistema 100% operacional — 6/6 serviços, 7/7 intents tool_direct

---

## Contexto

Uma bateria de 28 sub-testes foi executada sobre o stack completo do Workspace Mobile. O resultado inicial foi 22/28 com 4 bugs identificados. Duas sessões consecutivas de Claude Sonnet 4.6 trabalharam na resolução, com diagnóstico colaborativo e execução via MCP workspace-telemovel.

---

## Bugs Tratados

### BUG #1 — list_cerebro: falso positivo no verifyCommandSafety
**Severidade original:** 🔴 crítico  
**Status:** ✅ resolvido

**Sintoma:** Intent `listar arquivos do cerebro` roteava correto (`TOOL_CALL → list_cerebro`) mas retornava `source: local` com resposta vazia do Qwen em vez de executar o comando real.

**Investigação (sessão 1):** Confirmou que `list_cerebro` estava na `DIRECT_OUTPUT_TOOLS` nos dois pontos do `ollama_agent.js`. Identificou que `toolOutput` chegava vazio — o executor estava falhando silenciosamente.

**Causa raiz (sessão 2):** O `verifyCommandSafety` em `executor.js` bloqueava o comando com `SECURITY ALERT`. O regex anti-fork-bomb `/:.*\(.*\).*\{.*/` trigava em `Memoria-RAG; do base=...($d)` — a string `Memoria-RAG` contém `:`, seguida de `(`, `)`, `{` no loop bash normal. Falso positivo.

**Fixes aplicados:**
1. `executor.js` linha 30: regex corrigido de `/:.*\(.*\).*\{.*/` para `/:.*\(\s*\)\s*\{/` (fork bomb real exige `()` adjacente a `{`, sem conteúdo).
2. `tool_registry.json` — comando do `list_cerebro` reescrito: substituído loop bash com subshell aritmético por `find ... | python3 -c "..."` inline, que não contém o padrão problemático.

**Resultado confirmado:** `source: tool_direct`, filesystem real listado com pastas e tamanhos.

---

### BUG #2 — MiniSearch.loadJSON: reclassificado como não-bug
**Severidade original:** 🔴 crítico  
**Status:** ℹ️ diagnóstico original incorreto

**Alegação original:** `MiniSearch.loadJSON()` teria sido removido na v7.x.

**Verificação:** `minisearch v7.2.0` instalada. Teste ao vivo confirmou:
- `typeof MiniSearch.loadJSON` → `function`
- `typeof MiniSearch.loadJSONAsync` → `function`
- Cache v1 (408KB, 334 docs) carrega e executa busca corretamente
- Busca por "RAG" retorna 97 resultados reais

**Conclusão:** API mantida na v7. `vector_db.js` funciona sem alteração. Nenhum fix necessário.

---

### BUG #3 — index_cerebro.py: timeouts em arquivos grandes
**Severidade original:** 🟡 warning  
**Status:** ✅ resolvido (sessão anterior ao diagnóstico)

**Causa:** Timeout de 20s insuficiente para arquivos com 60+ chunks sob carga alta do llama-server.

**Fix aplicado:** `index_cerebro.py` atualizado com:
- `TIMEOUT_S = 45` (era 20s)
- `MAX_RETRY = 3` com backoff exponencial (`RETRY_WAIT = 2s`)
- Função `get_embedding(text, attempt)` recursiva com `time.sleep(wait * attempt)`

---

### BUG #4 — hub_pwa offline: caminho errado no start script
**Severidade original:** 🟡 warning (listado como node_modules)  
**Status:** ✅ resolvido — causa real diferente da descrita

**Causa real:** `03_start_services.sh` tinha `HUB="/data/data/com.termux/files/home/hub_pwa"` — caminho que não existe. O hub_pwa real está em `/storage/emulated/0/Workspace/Projetos/hub_pwa`.

O diagnóstico original descreveu o problema como "sem node_modules próprios" — mas o diretório `node_modules` já existia com express 4.22.2 e dotenv instalados. O processo simplesmente nunca subia porque o script de boot não encontrava o diretório.

**Fix aplicado:**
```bash
sed -i 's|HUB="/data/data/com.termux/files/home/hub_pwa"|HUB="/storage/emulated/0/Workspace/Projetos/hub_pwa"|' \
  Scripts/bootstrap/03_start_services.sh
```

Hub subido via nohup e confirmado em `/hub/status` → `{"status":"operational"}`.

---

## Estado Final do Sistema

### Serviços
| Serviço | Porta | Status |
|---|---|---|
| llama-server | 11434 | ✅ ONLINE |
| workspace_agent | 3333 | ✅ ONLINE |
| api_rest | 4000 | ✅ ONLINE |
| agente_local (Chronos) | 4001 | ✅ ONLINE |
| android_bridge | 4444 | ✅ ONLINE |
| hub_pwa | 5555 | ✅ ONLINE |

### Intent routing (agente :4001)
| Prompt | Intent | Source |
|---|---|---|
| quem voce e | TOOL_CALL | tool_direct ✅ |
| diagnostico | TOOL_CALL | tool_direct ✅ |
| uso de ram | TOOL_CALL | tool_direct ✅ |
| uso do disco | TOOL_CALL | tool_direct ✅ |
| git status | TOOL_CALL | tool_direct ✅ |
| mostrar kanban | TOOL_CALL | tool_direct ✅ |
| listar arquivos do cerebro | TOOL_CALL | tool_direct ✅ |
| o que e RAG? | KNOWLEDGE_QUERY | ⏳ Gemini quota |
| escreve um poema | CREATIVE_TASK | ⏳ Gemini quota |

### Versões no momento da estabilização
- **ollama_agent.js:** v2.2.0
- **tool_registry.json:** v2.7.2
- **executor.js:** regex fork bomb corrigido (sem versão explícita)
- **MiniSearch:** v7.2.0
- **Node.js:** v26.2.0
- **Express (hub_pwa):** v4.22.2

---

## Arquivos Modificados

```
Scripts/core/executor.js              — regex BLACKLISTED_COMMANDS linha 30
Scripts/core/tool_registry.json      — comando list_cerebro reescrito
Scripts/core/index_cerebro.py        — timeout 45s + retry (sessão anterior)
Scripts/bootstrap/03_start_services.sh — caminho HUB corrigido
```

## Arquivos Criados (trabalho de diagnóstico)

```
Scripts/core/fix_bug1_v2.py          — script de patch BUG #1
Scripts/core/check_regex.py          — verificação do regex
Scripts/core/check_regex2.py         — verificação com comando exato
Scripts/core/test_minisearch.mjs     — prova de funcionamento MiniSearch v7
Scripts/core/test_vector_db_real.mjs — teste do cache real
Scripts/core/audit_final.py          — auditoria completa do sistema
```

---

## Pendências Pós-Estabilização

1. **Gemini quota** — testar KNOWLEDGE_QUERY e CREATIVE_TASK após reset de quota (meia-noite). Se continuar falhando, verificar `GEMINI_API_KEY` no `.env`.
2. **Cache vetorial v2** — indexação em 38/53 docs. Retomar `index_cerebro.py` para completar os 15 arquivos restantes com o novo timeout de 45s.
3. **hub_pwa persistência** — monitorar se o processo sobrevive a um restart completo do Termux usando o `03_start_services.sh` corrigido.

---

## Lição Aprendida

O bug de maior impacto (BUG #1) tinha **três camadas** que a sessão anterior não conseguiu perfurar por completo:
1. `list_cerebro` ausente no `tool_registry` → corrigido na sessão 1
2. `list_cerebro` ausente no `DIRECT_OUTPUT_TOOLS` → corrigido na sessão 1 (mas era sintoma, não causa)
3. `verifyCommandSafety` bloqueando o comando → causa raiz, corrigida na sessão 2

A investigação via `executor-audit.log` foi decisiva: o log registrava `SECURITY ALERT` exatamente com o comando do `list_cerebro`, revelando a causa raiz sem ambiguidade. **Sempre checar os logs de auditoria do executor antes de depurar a camada de dispatch.**
