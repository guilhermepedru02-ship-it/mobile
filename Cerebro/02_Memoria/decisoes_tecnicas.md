# Decisões Técnicas do Workspace

## [2026-05-29] Ollama — Instalação e Validação no Termux

**Decisão:** Usar `pkg install ollama` como método de instalação (repositório oficial Termux).
**Versão instalada:** 0.24.0 ARM64
**Motivo:** Binário nativo ARM64 no repositório oficial do Termux — zero dependências externas, zero lixo residual. Alternativas (compilar da fonte, binário DioNanos) descartadas por complexidade desnecessária.

### Hardware do Dispositivo
| Métrica | Valor |
|---|---|
| Arquitetura | aarch64 (ARM64) |
| RAM Total | 3.7 GB |
| RAM disponível (idle) | ~1.8 GB |
| RAM disponível (modelo carregado) | ~825 MB |
| RAM consumida pelo modelo | ~970 MB |
| Armazenamento livre | 84 GB |

### Modelo Validado
| Métrica | Valor |
|---|---|
| Modelo | llama3.2:1b |
| Tamanho | 1.3 GB |
| Cold start (primeira carga) | ~6.6 segundos |
| Velocidade de inferência | ~0.5 tokens/segundo |
| Tempo total (10 tokens) | ~30 segundos |
| Janela de contexto usada | 27 tokens prompt + 10 gerados |

### Decisão Crítica de Arquitetura
**`run_command` via MCP NÃO é viável para inferência síncrona** — o timeout do executor (60s) é insuficiente para prompts longos. A IA local DEVE ser acessada exclusivamente via API HTTP (porta 11434). Isso valida a arquitetura do `ollama_agent.js` planejada no Milestone 2.

### Modelos Descartados
- `mistral:7b-q4` — requer ~4GB RAM, inviável (dispositivo tem 3.7GB total)
- `llama3.2:3b` — requer ~2.5GB RAM, deixaria <300MB para o sistema

### Como iniciar o Ollama
```bash
# Sessão dedicada no Termux (não pode ser via run_command do MCP)
ollama serve &
# Teste de inferência via API
curl -s http://localhost:11434/api/generate \
  -d '{"model":"llama3.2:1b","prompt":"Seu prompt","stream":false,"options":{"num_predict":50}}'
```

---

## [2026-05-30] Migração: Ollama + llama3.2:1b → llama-server + Qwen 2.5 0.5B Q4

**Decisão:** Substituir Ollama (daemon) por `llama-server` (llama-cpp nativo no Termux) e trocar modelo.
**Motivo:** llama3.2:1b travava o dispositivo ao ser carregado — ~970MB só para o modelo + Android + Termux + serviços excediam a RAM física de 3.7GB. Sem recuperação possível por software.

### Novo Stack de Inferência
| Métrica | Antes (Ollama) | Depois (llama-server) |
|---|---|---|
| Motor | Ollama 0.24.0 | llama-cpp (pkg b9360) |
| Modelo | llama3.2:1b (1.3GB) | Qwen2.5 0.5B Q4_K_M (469MB) |
| RAM do modelo | ~970MB | ~466MB |
| RAM total do sistema | Saturava (crash) | ~2.0GB usados / 1.4GB livres |
| Velocidade | ~0.5 tok/s | ~12 tok/s |
| API | `/api/generate` (Ollama) | `/v1/chat/completions` (OpenAI-compat) |
| Formato request | `{model, system, prompt}` | `{model, messages:[{role,content}]}` |
| Parsing resposta | `data.response` | `data.choices[0].message.content` |
| Porta | 11434 | 11434 (sem mudança) |
| ctx-size | N/A | 1024 tokens |

### Arquivos Modificados
- `Scripts/core/ollama_agent.js` — URL, modelo, formato request/response, auto-unlock Gatekeeper no startup
- `Scripts/core/mcp_generate_with_fallback.mjs` — URL, modelo, formato curl, critério de sucesso
- `Scripts/core/context_builder.js` — RAG condicional (desativado quando há tool result), toolOutput truncado a 200 chars
- `Scripts/core/start_llama_server.sh` — NOVO: script padronizado de inicialização

### Comando de Inicialização (substitui `ollama serve`)
```bash
bash /storage/emulated/0/Workspace/Scripts/core/start_llama_server.sh
# Ou diretamente:
llama-server \
  --model /storage/emulated/0/Workspace/Models/qwen2.5-0.5b-instruct-q4_k_m.gguf \
  --ctx-size 1024 --port 11434 --host 127.0.0.1 \
  --threads 4 --batch-size 64 --no-mmap
```

### Pendência Conhecida
- llama-server não reinicia automaticamente após kill do Android — adicionar ao script de bootstrap.
