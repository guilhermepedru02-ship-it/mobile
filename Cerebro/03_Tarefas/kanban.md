# Kanban do Workspace Mobile

> Atualizado em 09/06/2026 · Sessão Claude Sonnet 4.6 via MCP · **TTS Queue System v2.0 implementado e validado** ✔️

---

## 🎯 Objetivos Atuais

- **PRÓXIMO SPRINT:** Testes de integração do sprint 09/06 + primeira sessão colaborativa Multi-IA real
- **SEQUÊNCIA:** Validar A → B → C → D em produção

---

## 🔨 Em Progresso

_Nenhum. Sprint 09/06 concluído._

**Aguardando:** Testes manuais das 4 tasks via Telegram + validação biométrica ao vivo.

---

## 📋 Backlog

### Testes de Validação Sprint 09/06
- [x] **Teste TASK-A (validado em código):** `read_battery` → `{"percentage":100, "status":"FULL", "temperature":25.9}` ✅
- [x] **Teste TASK-A (validado em código):** `read_wifi` → `{"ssid":"Família Moreno", "ip":"192.168.15.6", "rssi":-64}` ✅
- [ ] **Teste TASK-B:** Claude via MCP executa diagnóstico e narra via TTS — ouvir resposta
- [ ] **Teste TASK-C:** Criar tool com `requires_biometric: true` e testar gate ao vivo
- [ ] **Teste TASK-D:** Duas IAs trocam mensagem no `multiia_channel.md` — validar lock

### Multi-IA — Próxima Fase
- [ ] **Implementar endpoint `/mcp/sessions`** em `mcp_server.js` — lista IAs conectadas por token
- [ ] **Sessão colaborativa real:** Claude planeja → Antigravity executa → Guilherme valida
- [ ] **Documentar protocolo final** em `02_Memoria/decisoes_tecnicas.md`

### 🔧 Backlog — Infraestrutura (mantido)
- [x] ~~**TTS bridge timeout** · `termux-tts-speak` síncrono bloqueia `runTermuxCommand`~~ → **RESOLVIDO: TTS Queue System v2.0** (spawn + fila FIFO + resposta imediata)

- [ ] **Escopo `read:storage` dedicado** · `bridge_permissions.json` v1.2
- [ ] **hub_pwa /hub/services** · adicionar svc-hub (5555) ao health check próprio
- [ ] **MCP: registrar android_bridge como tool** · expor /bridge/* como MCP tool diretamente
- [ ] **Filtro temporal no RAG** · memórias recentes com peso maior na busca semântica
- [ ] **Automação IoT Infravermelho** · `termux-infrared-transmit` para controle de dispositivos

### 📱 App Nativo (Plano Mestre — mantido)
- [ ] **Fase 1** · Interface nativa Android substituindo bot Telegram
- [ ] **Fase 2** · SQLite persistence + histórico de conversas

---

## ✅ Concluído

### 09/06/2026 — TTS Queue System v2.0 (Claude Sonnet 4.6 via MCP)
- [x] **Bug fix:** `console.log` na inicialização corrigido (v1.0.0 → v2.0.0)
- [x] **`import { exec, spawn }`** — spawn adicionado ao child_process
- [x] **`segmentText()`** — segmentação automática em pontuação natural (máx 120 chars)
- [x] **`processTtsQueue()`** — worker assíncrono FIFO, não-bloqueante, safety timer 20s
- [x] **`POST /bridge/tts`** — fila com resposta HTTP imediata (não bloqueia mais)
- [x] **`GET /bridge/tts/status`** — monitoramento público em tempo real
- [x] **`POST /bridge/tts/cancel`** — para processo spawn + limpa fila
- [x] **Bridge reiniciado** · v2.0.0 em produção, todos os testes passaram
- [x] **Testes end-to-end:** enqueue simples ✅ · segmentação (2 segs) ✅ · cancel ✅ · status ✅

### 09/06/2026 — Hotfix Bridge Tools (Claude MCP)
- [x] **HOTFIX-bridge-tools** · tool_registry v2.9.1 — corrigidas rotas, método HTTP (GET→POST) e env token
- [x] **HOTFIX-mcp_sessions** · redirecionado para /health real do MCP server (rota /mcp/sessions não existia)
- [x] **HOTFIX-bot-status** · Chronos v4.1 — adicionados Bridge (4444), Hub PWA (5555), WS Agent (3333)
### 09/06/2026 — Sprint Evolução Dinâmica (A+B+C+D)

- [x] **TASK-0609-A** · tool_registry v2.8.0 — +4 sensor tools (battery, wifi, location, sensors) + 74 keywords PT-BR
- [x] **TASK-0609-B** · TTS narração — `SKILL_tts_narracao.md` + protocolo fire-and-forget no `system_prompt.md`
- [x] **TASK-0609-C** · Gate biométrico — `biometric_gate.sh` + middleware `dispatch.js` v2.9.0 + 7ª camada `seguranca.md`
- [x] **TASK-0609-D** · Multi-IA canal — `multiia_channel.md` criado + tool_registry v2.9.0 (+channel_read, channel_write, mcp_sessions)

**Commits do Sprint:**
- `359dcc4` — feat: tool_registry v2.8.0 (TASK-A)
- `c40edb9` — feat: TTS narracao protocolo (TASK-B)
- `b177a64` — feat: biometric gate (TASK-C)
- `(pendente)` — feat: multi-ia canal colaboracao (TASK-D)
- `(pendente)` — feat: TTS Queue System v2.0

### 08/06/2026 — Re-indexação e Git
- [x] **Git Push** · Commit 45adcfb push origin main no GitHub.
- [x] **Cron RAG** · Job agendado ativo no Termux (`0 23 * * * consolidate_rag.js`).
- [x] **Re-indexação RAG** · Guia_Ativacao, estabilizacao_mestre e resumo_06-03 indexados.
- [x] **TTS** · 100% operacional.
- [x] **Limpeza Gemini/Claude** · Removido de agent_rules, cloud_bridge, bot.js e .env.
- [x] **Diagnóstico Massivo v3** · 45 sensores mapeados, 37 APIs Termux, stack validado.

### 05/06/2026 — Diagnóstico Massivo v2
- [x] **Stack 7/7 validado** · todos ONLINE.
- [x] **Intent routing 8/8** · todos os TOOL_CALL roteando `tool_direct`.
- [x] **Bridge READ validada** · battery + wifi funcionando.
