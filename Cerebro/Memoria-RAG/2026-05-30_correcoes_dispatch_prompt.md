# Correções + Plano de Memória Hierárquica — 2026-05-30
**Projeto:** Qualidade das interações da IA local

## Bugs corrigidos nesta sessão
- **system_prompt JSON:** LLM gerava JSON bruto em vez de linguagem natural. Correção: dois prompts separados (SYSTEM_PROMPT para conversa, SYSTEM_PROMPT_SYNTHESIS para sintetizar resultado de ferramenta)
- **Word-boundary no dispatch:** keyword `ram` casava dentro de `ferramentas`. Correção: regex com boundary `(^|\s)keyword(\s|$)`
- **ollama_status desatualizado:** ainda chamava `ollama list`. Substituido por `llm_status` apontando para llama-server
- **list_tools adicionado:** `/local quais ferramentas você tem` agora funciona
- **services_health adicionado:** `/local status dos serviços` dispara o painel completo

## Palavras-chave
#dispatch #system-prompt #word-boundary #tool-registry #qualidade