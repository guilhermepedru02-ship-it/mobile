# Avaliação Arquitetural Profunda — Claude como Centro de Raciocínio

**Data:** 2026-06-01  
**Agente:** Claude Sonnet 4.6 via MCP workspace-telemovel  
**Contexto:** Sessão de diagnóstico massivo + avaliação honesta do sistema por IA externa de alta capacidade

---

## Pergunta Central Respondida

Guilherme questionou se o sistema é realmente utilizável para IAs externas de alta capacidade (Claude, Antigravity) e se o desenvolvimento massivo via Claude+MCP é viável.

**Resposta direta:** Sim. O sistema é transparente, navegavel e operacionável por IA externa com autonomia crescente.

---

## O Que Funciona de Verdade (Validado ao Vivo)

### Camada de Infraestrutura — Sólida
- Gatekeeper + Sandbox + Blacklist funcionando em todos os testes
- workspace_agent (3333): 9 rotas respondendo em <100ms
- executor.js: tratamento de erro correto, path traversal bloqueado
- working_memory: arquivamento de tarefas funcionando
- llama-server: embeddings com `--pooling mean` estável

### Visibilidade do Sistema para IA Externa
- Claude enxerga estrutura, arquivos, versões, logs e histórico de decisões
- Memória RAG acumula contexto real entre sessões — a cada sessão Claude chega mais orientado
- Convenções de path consistentes, documentação interna legível por máquina
- Gatekeeper não bloqueia Claude porque executor faz auto-unlock via README.md

### Fluxo de Desenvolvimento Massivo (Validado)
```
Guilherme descreve intenção
  → Claude lê arquivos relevantes via MCP
  → Claude entende estado real do sistema
  → Claude escreve código e salva via create_file / workspace_agent
  → Claude verifica via shell_exec
  → Claude commita via git
  → Zero copiar-e-colar
```

---

## Limites Identificados e Suas Causas Reais

### workspace_agent /apply_patch — Frágil
- Requer arquivo existente + diff com newlines literais em JSON
- Serializacao do diff via JSON é propensa a falha
- **Alternativa recomendada:** usar `write_file` com conteúdo completo — mais confiável

### Timeout MCP sob carga paralela
- Qwen 0.5B bloqueia event loop durante inferência (~50s)
- Múltiplos requests simultâneos ao agente local derrubam o MCP junto
- **Solução:** em sessões de desenvolvimento com Claude, parar o agente local (4001) e usar workspace_agent (3333) diretamente — Express puro, sem LLM, sem risco de timeout

### path convention do workspace_agent
- Caminhos são relativos ao WORKSPACE_ROOT
- Correto: `"Scripts/core/arquivo.js"`
- Errado: `"Workspace/Scripts/core/arquivo.js"` (cria subpasta Workspace/Workspace/)

### git push bloqueado via MCP
- Rede externa bloqueada no sandbox MCP
- Push sempre feito manualmente no Termux: `git push origin main`

---

## Arquivos Modificados nesta Sessão

| Arquivo | Alteração |
|---|---|
| `.gitignore` | Expandido: wm_*.json, vector_cache_v2, debug files, obsidian state |
| `Scripts/core/consolidate_rag.js` | Criado: consolida wm_*.json em _consolidated.md por dia |
| `Scripts/core/context_builder.js` | v2.2.0: sem tags [CTX], texto plano, system prompt <300 tokens |
| `Scripts/core/ollama_agent.js` | v2.1.0: tool_error_guard + quality_filter_v2 (sessão anterior) |
| `Scripts/core/dispatch.js` | v2.1.0: keywordMatches() com 3 estrategias em cascata |
| `Projetos/telegram_bot/bot.js` | Migrado Anthropic → Gemini, /status e /ia corrigidos |
| `Cerebro/00_Sistema/README.md` | Stack atualizada: Gemini como cloud fallback |
| `Cerebro/02_Memoria/decisoes_tecnicas.md` | Entrada: migração Anthropic → Gemini |
| `Cerebro/Memoria-RAG/*_consolidated.md` | 2 arquivos criados (129 JSONs consolidados) |

---

## Palavras-chave
#arquitetura #claude-como-centro #mcp #desenvolvimento-massivo #workspace-agent #limites-validados #2026-06-01
