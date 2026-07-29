# Resumo de Sessão — 2026-05-31 — dispatch.js v2.1.0 + Testes End-to-End

**Agente:** Claude Sonnet 4.6 via MCP workspace-telemovel  
**Protocolo:** Gatekeeper desbloqueado ✔️  
**Escopo:** Reconexão pós-timeout + fix dispatch.js + bateria de testes ao vivo

---

## 🔧 Fix Aplicado: dispatch.js v2.1.0

**Problema:** regex `(^|[\s,!?])kw([\s,!?]|$)` falhava em 3 cenários:
1. Prompt exato igual à keyword (ex: `"ram"` → `$` do regex não batia)
2. Keywords de uma palavra quando precedidas por alfanumérico
3. Edge cases de boundary chars

**Solução `keywordMatches()`:**
```javascript
// 1. Exact match (prompt === keyword)
// 2. Uma palavra: regex (?:^|[^a-z0-9])kw(?:[^a-z0-9]|$)
// 3. Multi-palavra: includes() direto (já específico o suficiente)
```

---

## 🧪 Resultados dos Testes (todos via porta 4001)

| Prompt | Intent | Tool | Source | Resultado |
|---|---|---|---|---|
| `"identidade"` | TOOL_CALL | identity_check | tool_direct | ✅ Card completo, sem JSON de erro |
| `"quanto de ram esta disponivel"` | TOOL_CALL | ram_status | tool_direct | ✅ Dados reais de RAM/Swap |
| `"como esta o sistema"` | TOOL_CALL | self_health_check | tool_direct | ✅ Diagnóstico completo, sem deriva emocional |
| `"ferramentas"` | TOOL_CALL | list_tools | tool_direct | ✅ 16 ferramentas listadas |
| `"tarefas"` | TOOL_CALL | kanban_read | tool_direct | ✅ Kanban completo lido |
| `"o que e o llama-server..."` | KNOWLEDGE_QUERY | — | local (LLM) | ⚠️ Alucinação (comportamento esperado para 0.5B) |

**Conclusão:** 5/5 tool_calls perfeitas. KNOWLEDGE_QUERY livre continua instável — limitação conhecida do Qwen 0.5B documentada desde 30/05.

---

## 📊 Estado Final do Sistema

| Serviço | Status |
|---|---|
| llama-server (11434) | ✅ Online + pooling=mean |
| workspace_agent (3333) | ✅ Online |
| Agente Local (4001) v2.1.0 | ✅ Online |
| MCP Server (3001) | ✅ Online |
| API REST (4000) | ✅ Online |
| Bot Telegram | ✅ Online |

## Arquivos Modificados nesta Sessão
- `Scripts/core/dispatch.js` → v2.1.0 (fix keywordMatches)
- `Scripts/core/ollama_agent.js` → v2.1.0 (já da sessão anterior)

## Palavras-chave
#dispatch-fix #keyword-boundary #testes-ao-vivo #tool-direct-ok #knowledge-query-limitacao-conhecida
