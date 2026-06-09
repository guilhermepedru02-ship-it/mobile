# Kanban do Workspace Mobile

> Atualizado em 09/06/2026 · Sessão Claude Sonnet 4.6 via MCP · **SPRINT 09/06 CONCLUÍDO** ✔️

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
- [ ] **Teste TASK-A:** Telegram `"bateria tá boa?"` → deve acionar `read_battery`
- [ ] **Teste TASK-A:** Telegram `"to na net?"` → deve acionar `read_wifi`
- [ ] **Teste TASK-B:** Claude via MCP executa diagnóstico e narra via TTS — ouvir resposta
- [ ] **Teste TASK-C:** Criar tool com `requires_biometric: true` e testar gate ao vivo
- [ ] **Teste TASK-D:** Duas IAs trocam mensagem no `multiia_channel.md` — validar lock

### Multi-IA — Próxima Fase
- [ ] **Implementar endpoint `/mcp/sessions`** em `mcp_server.js` — lista IAs conectadas por token
- [ ] **Sessão colaborativa real:** Claude planeja → Antigravity executa → Guilherme valida
- [ ] **Documentar protocolo final** em `02_Memoria/decisoes_tecnicas.md`

### 🔧 Backlog — Infraestrutura (mantido)
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
