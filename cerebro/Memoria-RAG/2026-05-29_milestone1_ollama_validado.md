# Resumo da Sessão — 2026-05-29 (Milestone 1 Concluído)
**Duração aproximada:** ~20 ações executadas
**Projeto:** Milestone 1 — Instalação e Validação do Ollama no Termux

## O que foi feito
- Reconexão MCP após queda do servidor (desbloqueio via README.md).
- Diagnóstico de hardware: aarch64, 3.7GB RAM física, 2.7GB swap, 84GB armazenamento livre.
- Instalação limpa via `pkg install ollama` — versão 0.24.0 ARM64.
- Binário instalado em `/data/data/com.termux/files/usr/bin/ollama` (PATH correto do Termux).
- Download do modelo `llama3.2:1b` (1.3GB, SHA256 verificado).
- Inferência validada via API HTTP (`/api/generate`, `stream:false`).
- Métricas coletadas, documentadas e registradas em `02_Memoria/decisoes_tecnicas.md`.
- Esclarecimento sobre RAM real vs. anunciada pelo fabricante documentado.

## Diagnóstico de Hardware Real
| Métrica | Valor |
|---|---|
| Arquitetura | aarch64 (ARM64) |
| RAM física real | **3.7 GB** |
| Swap (RAM estendida/virtual) | **2.7 GB** |
| Total efetivo | **~6.4 GB** |
| Armazenamento livre | 84 GB |
| RAM anunciada pelo fabricante | "12 GB" (inclui swap de armazenamento) |

> ⚠️ O "12GB" exibido nas configurações do celular inclui **RAM Estendida** (feature de fabricantes como Xiaomi, Samsung, OPPO) que usa armazenamento interno como memória virtual. É swap — 10x a 50x mais lenta que RAM física. A RAM real disponível para o Ollama é **3.7GB físicos**.

## Como Ativar a LLM Local (Passo a Passo)

O Ollama precisa de **duas sessões separadas no Termux**. Use o menu lateral (deslizar da borda esquerda) para criar novas sessões.

**Sessão dedicada ao Ollama (deixar sempre aberta):**
```bash
ollama serve
```
Aguardar a mensagem: `Listening on 127.0.0.1:11434`

**Validar que está rodando (qualquer outra sessão):**
```bash
curl http://localhost:11434
# Resposta esperada: Ollama is running
```

**Testar inferência diretamente:**
```bash
curl -s http://localhost:11434/api/generate \
  -d '{"model":"llama3.2:1b","prompt":"Olá, tudo bem?","stream":false,"options":{"num_predict":50}}'
```

> ⚠️ **NUNCA usar `run_command` do MCP para inferência** — o timeout do executor (60s) é insuficiente. O acesso correto é exclusivamente via API HTTP na porta 11434, que é o que o `ollama_agent.js` do Milestone 2 fará.

## Ciclo de Vida da RAM — Ela Consome o Tempo Todo?

**Não.** O comportamento é inteligente:

| Estado | RAM consumida |
|---|---|
| `ollama serve` rodando, modelo não carregado | **~50 MB** |
| Modelo carregado (após primeira chamada) | **~970 MB** |
| Após 5 minutos sem uso | **descarrega automaticamente → volta a ~50 MB** |
| Ollama parado | **0 MB** |

O modelo só ocupa RAM **enquanto está sendo usado ou nos 5 minutos seguintes ao último uso**. Depois disso, o Ollama libera a memória sozinho. O próximo request recarrega em ~6.6 segundos (cold start medido).

## Capacidades da LLM Local — Estado Atual vs. Pós-Milestone 2

| Capacidade | Agora | Pós-Milestone 2 |
|---|---|---|
| Responder perguntas gerais | ✅ | ✅ |
| Gerar texto e código simples | ✅ | ✅ |
| Conhecer o Workspace/sistema | ❌ | ✅ |
| Acionar ferramentas e scripts | ❌ | ✅ |
| Memória entre conversas | ❌ | ✅ |
| Receber comandos pelo Telegram (/local) | ❌ | ✅ (Milestone 3) |

## Modelos Disponíveis e Viabilidade

| Modelo | RAM necessária | Viável? | Velocidade estimada | Status |
|---|---|---|---|---|
| `llama3.2:1b` | ~1 GB | ✅ Confortável | ~0.5 tok/s | **Instalado e validado** |
| `llama3.2:3b` | ~2 GB | ✅ Possível | ~0.2 tok/s | **Testar após Milestone 2** |
| `mistral:7b-q4` | ~4 GB | ⚠️ Só com swap | muito lento | Descartado por ora |

## Decisões Tomadas
- **Modelo ativo:** `llama3.2:1b` — único viável para 3.7GB RAM física.
- **Acesso:** Exclusivamente via API HTTP porta 11434.
- **Log do Ollama:** `$TMPDIR/ollama.log` (Termux não tem `/tmp`).
- **Ollama serve:** Sessão dedicada no Termux, separada do MCP server.
- **Modelo 3b:** Testar após Milestone 2 estar completo e estável.

## Pendentes para próxima sessão
- [ ] Iniciar Milestone 2: `dispatch.js`, `tool_registry.json`, `working_memory.js`, `context_builder.js`, `ollama_agent.js`
- [ ] Após Milestone 2 estável: testar `llama3.2:3b` e comparar qualidade vs. velocidade

## Palavras-chave
#ollama #llama3 #ia-local #milestone1 #validado #arm64 #termux #api-http #inferencia #performance #ativacao #ram #ciclo-de-vida
