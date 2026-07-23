# Plano: Migração llama3.2:1b → Qwen 0.5B Q4 via llama.cpp
**Data:** 2026-05-30
**Status:** Concluído

## Objetivo
Substituir o Ollama + llama3.2:1b (inviável: ~970MB RAM, trava o sistema) por
llama.cpp + Qwen 0.5B Q4_K_M (~500MB RAM). Manter a arquitetura existente
(ollama_agent.js, mcp_generate_with_fallback.mjs) com mudanças cirúrgicas mínimas.

## Diagnóstico Pré-Execução
| Métrica | Valor |
|---|---|
| RAM disponível (idle) | 1.8 GB |
| Swap livre | 1.6 GB |
| Storage livre | 87 GB |
| Ollama rodando? | Não |
| Processos ativos | mcp_server.js, npm start |
| Espaço a liberar | ~1.3GB (modelo) + ~40MB (binário) |

## Etapas
1. [x] Diagnóstico do sistema
2. [ ] Remover modelo llama3.2:1b do Ollama
3. [ ] Desinstalar Ollama + limpar ~/.ollama
4. [ ] Instalar llama-cpp (pkg)
5. [ ] Criar diretório Models/ + baixar Qwen 0.5B Q4_K_M GGUF
6. [ ] Criar script de inicialização do llama-server
7. [ ] Atualizar ollama_agent.js (endpoint + formato API)
8. [ ] Atualizar mcp_generate_with_fallback.mjs
9. [ ] Atualizar Guia_Ativacao_Servicos.md
10. [ ] Testes end-to-end
11. [ ] Documentar na Memoria-RAG + atualizar kanban

## Mudanças Técnicas nos Scripts

### ollama_agent.js
- OLLAMA_URL: `http://localhost:11434/api/generate` → `http://localhost:11434/v1/chat/completions`
- OLLAMA_MODEL: `llama3.2:1b` → `qwen2.5-0.5b`
- Formato de request: {model, system, prompt} → {model, messages:[{role,content}]}
- Parsing de resposta: `data.response` → `data.choices[0].message.content`

### mcp_generate_with_fallback.mjs
- Mesmo endpoint e formato acima

### llama-server (substitui ollama serve)
```bash
llama-server \
  --model /storage/emulated/0/Workspace/Models/qwen2.5-0.5b-instruct-q4_k_m.gguf \
  --ctx-size 512 \
  --port 11434 \
  --host 127.0.0.1 \
  --threads 4 \
  --batch-size 64
```

## Riscos
- Download do GGUF (~400MB): lento, mas estável via curl com retry
- API llama-server usa /v1/chat/completions (OpenAI-compat) — zero mapeamento manual de prompt
- Contexto limitado a 512 tokens é suficiente para as tarefas do agente local

## Resultado Esperado
- `llama-server` rodando na porta 11434 com ~500MB RAM
- `/local` no Telegram respondendo em ~10-15s
- Sistema total (Android + Termux + serviços + modelo) < 3GB RAM
- Ollama e ~/.ollama completamente removidos do sistema
