# Decisões Técnicas do Workspace Mobile

## 2026-05-30 — Migração LLM: Ollama → llama-server (Qwen 2.5 0.5B Q4_K_M)

**Contexto:** Após múltiplas tentativas de otimização, o Ollama se mostrou incompatível com o hardware do dispositivo (3.7GB RAM). Travava o celular, derrubava todos os serviços e não retornava respostas ao Bot Telegram.

**Decisão:** Migrar completamente para `llama-server` (llama.cpp nativo) com Qwen 2.5 0.5B Q4_K_M.
- Menor consumo de RAM (~1GB)
- Compatibilidade com OpenAI API (`/v1/chat/completions`)
- Porta 11434 mantida para compatibilidade com o restante do código
- ctx-size reduzido para 1024 para economizar memória

**Impacto:** Zero breaking changes — todos os clientes já usavam a interface OpenAI-compat.

---

## 2026-05-30 — Arquitetura do Enxame (FASE 3)

**Decisão:** Implementar `cloud_bridge.js` + `consult_expert_ia` como fallback automático.
- Agente local tenta 2×; se falhar, delega para Anthropic API
- Controle de custo: máximo 20 chamadas/dia, alerta em 80%
- `agent_rules.json` centraliza toda a política de retry e delegação

**Pré-requisito:** `ANTHROPIC_API_KEY` no `.env` do Workspace.

---

## 2026-05-30 — workspace_agent como MCP Universal

**Decisão:** O Qwen 0.5B não é exposto como ferramenta exclusiva de nenhuma IA.
O `workspace_agent_server.js` (porta 3333) é o ponto de acesso universal para micro-tarefas.
Qualquer IA externa (Claude, Antigravity, Manus) usa o mesmo endpoint.

**Motivação:** Evitar dependência de uma única IA para operações de workspace. Soberania e intercambiabilidade.

---

## 2026-05-30 — zRAM Setup: Estratégia adotada

**Decisão:** Criar `00_zram_setup.sh` com dois caminhos:
1. **Com root:** zRAM nativo 1GB via `/sys/block/zram0` (algoritmo lz4)
2. **Sem root:** Swapfile 512MB em `~/.swapfile` via Termux

**Swappiness alvo:** 20 (otimizado para IA local, evita thrashing)

**Impacto esperado:** Liberação de ~512MB–1GB de pressão sobre a RAM física para o llama-server.

---

## 2026-05-30 — silent_execution ativado no agent_rules.json

**Decisão:** `silent_execution.enabled` alterado de `false` para `true`.
**Motivação:** Permite que delegações assíncronas ocorram em segundo plano sem bloquear a interface do usuário.
**Log:** `Logs/background_tasks.log`


---

## 2026-05-31 — Fix: Dispatch Unicode + RAG Blacklist + Keywords com acento

**Problema detectado:** Interação do Telegram `/local diagnóstico` falhou em 3 níveis encadeados.

**Bug 1 — dispatch.js:** `toLowerCase()` sem normalização Unicode. `"diagnóstico"` não casava com keyword `"diagnostico"`. Dispatch caía em `CREATIVE_TASK` sem ferramenta.
**Correção:** Função `normalize()` com `NFD + \p{Diacritic}` aplicada em ambos os lados (prompt e keyword). Permanente e sistêmica.

**Bug 2 — context_builder.js:** RAG indexava `00_Sistema/` (system_prompt, regras de segurança) e os injetava como contexto de resposta. Qwen confundia instruções operacionais com memória.
**Correção:** `RAG_BLACKLIST` com `Cerebro/00_Sistema` e `Cerebro/01_Planejamento`. Filtro aplicado em `semanticSearch()` e pattern de `loadRecentRAG()` restrito a `.md` datados (exclui `wm_*.json`).

**Bug 3 — tool_registry.json:** Keywords sem variantes acentuadas. `"diagnóstico"` (com acento) não estava listado.
**Correção:** v2.5.0 — todas as tools receberam variantes Unicode completas. `self_health_check` especificamente: `"diagnóstico"`, `"saúde"`, `"faça um diagnóstico"`, etc.

**Regra de governança estabelecida:** `00_Sistema/` e `01_Planejamento/` são meta-instruções do sistema — NUNCA contexto RAG. Apenas `Memoria-RAG/*.md` datados, `02_Memoria/preferencias_usuario.md` e `04_Diario/` são fontes válidas de contexto.

---

## 2026-05-31 — Cloud Bridge: Migração Anthropic → Gemini (Google AI Studio)

**Contexto:** A integração cloud originalmente planejada usava `ANTHROPIC_API_KEY`. Durante a implementação real, foi configurada a `GEMINI_API_KEY` (Google AI Studio) no `.env` do Workspace.

**Estado atual:**
- `GEMINI_API_KEY`: ✅ instalada e verificada no `.env`
- Backend ativo em `agent_rules.json`: `gemini` / `gemini-2.0-flash` / prioridade 1
- Limite diário: 20 chamadas/dia (conservador para plano gratuito)
- **Erro atual:** quota do plano gratuito do Google AI Studio — fallback inativo por quota, não por configuração

**Decisão:** Manter Gemini como backend primário. Quando a quota diária resetar (meia-noite PT), o fallback funciona automaticamente. Para uso intensivo, considerar upgrade para plano pago do Google AI Studio.

**Documentação corrigida:** README.md do 00_Sistema atualizado para refletir Gemini como cloud fallback.

---

## 2026-06-01 — Android Bridge Gateway (FASE 6)

**Contexto:** Com as FASES 0-5 estáveis (7/7 serviços verdes), chegou o momento de construir a ponte entre IAs externas e o Android. A FASE 6 adiciona dois novos serviços ao stack: Android Bridge Gateway (4444) e Hub PWA (5555).

**Arquitetura implementada (4 arquivos core):**

1. `bridge_permissions.json` — Sistema de escopos por identidade de IA. Claude tem 8 escopos (maior confiança), Antigravity tem 2, Gemini tem 1. Blacklist absoluta de 8 operações perigosas em hardcode.

2. `bridge_audit.js` — Log imutável em `Logs/android-bridge-audit.log`. Cada operação gera entrada com timestamp UTC, IA, escopo, operação e status. Exporta logAudit(), getAuditLog() e getAuditStats().

3. `bridge_middleware.js` — Middleware Express que implementa 4 camadas em sequência: (1) extrair token, (2) identificar IA por token, (3) verificar escopo, (4) verificar rate limit. Zero trust: toda IA é cliente externo não confiável por padrão.

4. `android_bridge.js` — Servidor Express na porta 4444 (apenas 127.0.0.1). READ: battery, wifi, location, clipboard/get, storage/list. WRITE: notification, clipboard/set, tts, intent/open. Kill switch via X-Owner-Key. Rotas blacklistadas retornam 403 permanente.

**Hub PWA (`Projetos/hub_pwa/`):**
- `server.js` (porta 5555): serve a PWA + proxy bridge + rota kanban
- `index.html` + `style.css` + `app.js`: interface dark mobile-first
- Funcionalidades: status dos 6 serviços, controles da bridge, kanban ao vivo, log de auditoria

**Pré-requisito crítico:** `pkg install termux-api` + app Termux:API da Play Store.

**Variáveis a adicionar ao .env:**
- BRIDGE_TOKEN_CLAUDE=<gerar token único>
- BRIDGE_TOKEN_ANTIGRAVITY=<gerar token único>
- BRIDGE_TOKEN_GEMINI=<gerar token único>
- BRIDGE_OWNER_KEY=<chave exclusiva Guilherme>

**Stack completo após FASE 6:**
| Porta | Serviço |
|---|---|
| 11434 | llama-server (Qwen) |
| 3001 | MCP Server |
| 3333 | workspace_agent |
| 4000 | API REST |
| 4001 | Agente Local |
| 4444 | Android Bridge |
| 5555 | Hub PWA |

**Princípio de design:** READ antes de WRITE — rotas de leitura devem ser validadas em produção por pelo menos 7 dias antes de habilitar as de escrita em qualquer processo automatizado externo.
