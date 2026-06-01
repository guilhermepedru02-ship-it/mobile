# Diagnóstico Definitivo do Qwen 0.5B — Limites e Papéis Corretos

**Data:** 2026-06-01  
**Fonte:** Dados reais dos consolidated.md (129 interações analisadas) + testes ao vivo

---

## O que os Dados Mostram

### Do 2026-05-31_consolidated.md (45 interações)
- **TOOL_CALL:** 20 interações — 100% de acerto, respostas corretas e determinísticas
- **CREATIVE_TASK:** 18 interações — ~0% de utilidade real, alucinacões frequentes
- **KNOWLEDGE_QUERY:** 7 interações — falha na maioria, fallback Gemini acionado (quota esgotada)

### Exemplos de falha documentados
```
Prompt: "esse sistema possui nível de autonomia local?"
Resposta: "Chronos: Como você está se sentindo hoje?"

Prompt: "o que e RAG"
Resposta: "O relatório foi enviado para: `o que e RAG[/CTX]`"

Prompt: "bom dia"
Resposta: "Obrigado por compartilhar o relatório gerado. Se precisar..."
```

---

## Causa Raiz dos Problemas (Não é Bug — É Limite do Modelo)

### 1. Janela de contexto efetiva ~200 tokens
O system prompt ocupa ~300-400 tokens. Sobram menos de 200 para prompt + RAG + resposta. O modelo começa a "esquecer" o início do system prompt enquanto processa o final.

### 2. Não generaliza instrução → comportamento
"NUNCA diga Olá" funciona nos primeiros tokens, depois varia. Não é desobediência — é limite de atenção do modelo 0.5B.

### 3. Reproduz estrutura do prompt como conteúdo
O `[CTX]...[/CTX]` era reproduzido literalmente nas respostas. Corrigido no context_builder v2.2.0 com texto plano.

### 4. Dataset de treinamento — derivas involuntárias
O Qwen 0.5B foi treinado em dados genéricos. Respostas emocionais ("como você está se sentindo") e relatórios inventados ("total de 4 linhas processadas") são padrões do dataset que emergem quando o sistema prompt não domina totalmente a atenção do modelo.

---

## Papéis Corretos do Qwen 0.5B neste Sistema

### ✅ DEVE fazer (funciona 100%)
- **Classificador de intent:** via dispatch.js (word matching, sem LLM)
- **Executor de ferramentas:** retorna dados reais via shell/filesystem
- **Triagem de keywords:** identifica qual ferramenta acionar
- **Health check local:** verifica RAM, disco, servicos

### ❌ NÃO DEVE fazer (falha consistentemente)
- Responder perguntas abertas de conhecimento
- Explicar conceitos técnicos
- Manter persona consistente em conversação livre
- Sintetizar informações do RAG
- Qualquer tarefa que exija raciocínio encadeado

---

## Arquitetura Recomendada (Validada)

```
USUÁRIO
   ↓
[DISPATCH] ← keyword matching puro (sem LLM)
   ↓              ↓
TOOL_CALL    KNOWLEDGE/CREATIVE
   ↓              ↓
[EXECUTOR]   [CLOUD IA] ← Claude / Gemini / Antigravity
   ↓              ↓
 tool_direct    resposta real
```

O Qwen 0.5B sai do caminho crítico de raciocínio. Ele vira um roteador rápido e um executor de shell confiável. Toda síntese vai para cloud.

---

## Estado Atual das Correções Aplicadas

| Problema | Status | Correção |
|---|---|---|
| identity_check → Python inexistente | ✅ Corrigido | shell inline no tool_registry v2.7.1 |
| JSON de erro vazando como resposta | ✅ Corrigido | tool_error_guard no ollama_agent v2.1.0 |
| Deriva emocional não detectada | ✅ Corrigido | quality_filter_v2 no ollama_agent v2.1.0 |
| [CTX] reproduzido na resposta | ✅ Corrigido | context_builder v2.2.0 texto plano |
| Dispatch não casava keywords | ✅ Corrigido | dispatch v2.1.0 keywordMatches() |
| KNOWLEDGE_QUERY livre — alucinacão | ⚠️ Estrutural | Requer cloud ativo (Gemini quota) |

---

## Palavras-chave
#qwen-0.5b #limites-modelo #arquitetura #tool-direct #cloud-fallback #dados-reais #2026-06-01
