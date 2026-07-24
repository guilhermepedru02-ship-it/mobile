# Resumo de Sessão — 2026-05-31 — Correção 3 Bugs Críticos (ollama_agent.js v2.1.0)

**Agente:** Claude Sonnet 4.6 via MCP workspace-telemovel  
**Protocolo:** Gatekeeper desbloqueado via `Cerebro/00_Sistema/README.md` ✔️  
**Escopo:** Análise massiva para continuar implementação interrompida por tokens + aplicar 3 correções identificadas na sessão anterior

---

## 🔍 Arquivos Lidos (Análise Massiva)

- README.md, system_prompt.md, seguranca.md, ferramentas_disponiveis.md
- kanban.md, preferencias_usuario.md
- Memória-RAG: 2026-05-31_implementacao_completa.md
- Diário: 2026-05-30.md
- Scripts/core/ollama_agent.js (v2.0.0 — versão com bugs)
- Scripts/core/tool_registry.json (v2.7.0 — já corrigido)
- Scripts/core/dispatch.js
- Scripts/core/context_builder.js
- Scripts/core/executor.js

**Diagnóstico:** `tool_registry.json` já estava em v2.7.0 com o Bug1 corrigido (shell inline). Os Bugs 2 e 3 estavam no `ollama_agent.js` v2.0.0.

---

## 🛠️ Correções Aplicadas em `ollama_agent.js` v2.1.0

### Bug 1 (já corrigido no registry v2.7.0)
- `identity_check` apontava para `identity_report.py` (não existia)
- Corrigido: shell inline no `tool_registry.json`
- `ollama_agent.js` herdou a correção automaticamente

### Bug 2 — FIX: `tool_error_guard` (pipeline de erro)
**Problema:** `executeTool()` retorna `{ success: false, error: '...' }` quando falha. O código antigo extraia `result.content || result.stdout || result.detail || JSON.stringify(result)` sem verificar `result.success` — o JSON de erro ia direto como `toolOutput`.

**Solução:**
```javascript
const toolFailed = result.success === false;
if (toolFailed) {
    // Ferramenta DIRECT_OUTPUT: resposta amigável sem LLM
    // Outras: pipeline continua sem toolOutput (RAG conversacional)
}
```
- O check `if (tool.id === 'identity_check' && toolOutput)` passou a incluir `&& !toolFailed`
- O DIRECT_OUTPUT bypass passou a incluir `&& !toolFailed`

### Bug 3 — FIX: `quality_filter_v2` (deriva emocional + JSON cru)
**Problema:** `isLowQuality()` detectava repetição e tech drift, mas não:
- Deriva emocional (Qwen respondendo "como você está se sentindo?" para perguntas técnicas)
- Resposta comecando com JSON cru (erro de ferramenta vazando pelo LLM)
- Conteúdo completamente off-topic

**Solução — 4 detectores adicionados:**
```javascript
// 4. Deriva emocional
const emotionalDrift = /como voc[eê] est[aá] se sentindo|estou (bem|ótimo|pronto),.../i;
if (emotionalDrift.test(resp) && !/sentindo|emoc|humor/i.test(userPrompt)) return true;

// 5. JSON cru no início da resposta
const jsonLeak = /^\s*\{\s*"(success|error|type|code)"/;
if (jsonLeak.test(resp)) return true;

// 6. Off-topic total
const offTopic = /receita de|previsao do tempo|campeonato/i;
if (offTopic.test(resp) && !/receita|clima|tempo/i.test(userPrompt)) return true;
```

**GENERIC_PATTERNS expandido:**
```javascript
/^como voc[eê] est[aá] se sentindo/i,
/^estou (bem|ótimo|ótima|pronto|pronta),?\s*(obrigad|como posso|o que)/i,
/^(é claro que|claro que)\s*(estou|sim|posso)/i,
```

---

## 📄 Arquivos Modificados

| Arquivo | Versão | Alteração |
|---|---|---|
| `Scripts/core/ollama_agent.js` | v2.0.0 → v2.1.0 | 3 bugs corrigidos |
| `Cerebro/03_Tarefas/kanban.md` | — | Atualizado com v2.1.0 concluído |
| `Cerebro/Memoria-RAG/2026-05-31_bugs_corrigidos.md` | — | Este arquivo |

---

## ⏳ Próximos Passos (Guilherme faz no Termux)

1. **Reiniciar agente local** (IMEDIATO):
   ```bash
   pkill -f ollama_agent
   nohup node Scripts/core/ollama_agent.js > Logs/agent.log 2>&1 &
   ```
2. **Testar `identity_check`** via Telegram `/chronos quem e voce` — deve retornar card sem erro JSON
3. **Testar `self_health_check`** via `/como esta o sistema` — deve retornar saúde sem deriva emocional
4. **Git push** para sincronizar v2.1.0 no GitHub
5. **Reiniciar llama-server com `--pooling mean`** para FASE 4 vetorial

---

## Palavras-chave
#bug-fix #ollama-agent-v2.1.0 #tool-error-guard #quality-filter-v2 #identity-check #deriva-emocional #json-leak #pipeline-corrigido
