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
