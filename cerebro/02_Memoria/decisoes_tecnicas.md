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

---

## 2026-06-01 — Android Bridge: Escopos de Segurança por Identidade de IA

**Contexto:** Com a FASE 6 (Android Bridge), foi necessário definir uma política de acesso ao hardware por IA.

**Decisão:** Sistema de escopos escalonado em `bridge_permissions.json` v1.1.0:
- **Claude (confiada, externa):** 8 escopos — read:battery, read:wifi, read:location, read:clipboard, read:storage, write:notification, write:clipboard, write:tts. Rate: 60 req/h.
- **Antigravity (local):** 2 escopos — read:battery, read:wifi. Rate: 20 req/h.
- **Gemini (cloud, menos confiada):** 1 escopo — read:battery. Rate: 10 req/h.
- **Blacklist absoluta (hardcode, sem exceções):** sms, camera, microphone, contacts, call, record_audio, delete_file, factory_reset.

**Princípio:** Zero trust — toda IA é cliente não confiável por padrão. Autenticação em 4 camadas: token → identidade → escopo → rate limit. Falha em qualquer camada = bloqueio + audit log.

**Nota de segurança:** `read:clipboard` e `read:storage` removidos de IAs cloud (Claude, Gemini) na revisão v1.1.0 — dados do clipboard transitando para servidores externos foram identificados como vulnerabilidade arquitetural real. IAs locais (Qwen, Antigravity) mantêm esses escopos pois os dados ficam no dispositivo.

---

## 2026-06-02 — Hub PWA: Proxy Server-Side para Resolver CORS

**Contexto:** A arquitetura original do Hub PWA (`app.js`) chamava a Android Bridge (porta 4444) diretamente do browser. Isso causava erros CORS porque o browser bloqueia requisições cross-origin mesmo em localhost quando as portas diferem.

**Decisão:** O `server.js` (porta 5555) passou a funcionar como proxy reverso para a bridge:
- `POST /proxy/bridge/:action` → encaminha para `http://127.0.0.1:4444/bridge/:action` com token do `.env`
- `GET /proxy/bridge/audit` → encaminha para `/bridge/audit` com header `x-owner-key`
- `GET /hub/services` → health check server-side dos 7 serviços (evita CORS em cada porta)

**Impacto:** `app.js` agora faz todas as chamadas para o mesmo origin (5555 → 5555), sem dependência de CORS. O token da bridge nunca fica exposto no código cliente — o proxy o injeta server-side via `process.env.BRIDGE_TOKEN_CLAUDE`.

---

## 2026-06-03 — Python no Termux: pip3 vs pkg install

**Contexto:** Relatório anterior documentava `pip3 install` como "quebrado" genericamente. Após diagnóstico, a realidade é mais precisa.

**Decisão / regra permanente:**
- `pip3 install` funciona normalmente para pacotes pure Python (requests, flask, httpx, etc.).
- Pacotes com extensões C/Fortran (numpy, pillow, scipy) **não compilam via pip** no Termux — usar `pkg install python-<nome>`.
- Não é um bug a ser corrigido; é uma limitação estrutural do ambiente Termux sem toolchain completo.

**Estado (2026-06-03):** python-numpy 2.4.4, python-pillow 12.2.0, python-scipy 1.17.1 instalados e funcionais via pkg.
