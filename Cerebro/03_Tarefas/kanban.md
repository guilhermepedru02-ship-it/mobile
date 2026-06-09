# Kanban do Workspace Mobile

> Atualizado em 09/06/2026 · Sessão Claude Sonnet 4.6 via MCP · TASK-0609-A concluída

---

## 🎯 Objetivos Atuais

- **SPRINT 09/06:** Evolução Dinâmica — Sensores, TTS, Biometria e Multi-IA
- **SEQUÊNCIA:** A → B → C → D (ordem de dependência e complexidade crescente)

---

## 🔨 Em Progresso

### TASK-0609-B · TTS para IAs Externas via MCP
> **Origem:** Diário 09/06 · **Complexidade:** Baixa-média · **Impacto:** UX alto
> **Depende de:** TASK-0609-A (paralelo OK) · TTS já funcionando (08/06)
>
> IAs externas (Claude, Antigravity) narram em voz real o que estão fazendo no sistema.

- [ ] Definir protocolo de narração: quando e como a IA chama `/bridge/write/tts`
  - Trigger obrigatório: início de diagnóstico, operações críticas, resultados de ferramenta
  - Trigger opcional: cada passo de implementação em andamento
- [ ] Criar skill dedicada em `00_Sistema/SKILL_tts_narracao.md` com diretiva para IAs externas
  - Formato: `"[IA]: [ação em curso] — [resultado esperado]"`
  - Ex: `"Claude: Lendo tool_registry — adicionando sinônimos de bateria"`
- [ ] Integrar diretiva no `system_prompt.md` como protocolo obrigatório para IAs cloud
- [ ] Validar escopo `write:tts` no `bridge_permissions.json` para Claude (já deve estar ativo)
- [ ] Testar: Claude via MCP narrar um diagnóstico inteiro em voz — ouvir resposta em tempo real
- [ ] Avaliar latência: TTS deve ser não-bloqueante (fire-and-forget via curl async)
- [ ] Documentar na `Memoria-RAG/` como `2026-06-09_tts_ias_externas.md`
- [ ] Commit: `feat: TTS narração protocolo para IAs externas via MCP`

---

## 📋 Backlog

### TASK-0609-C · Segurança Biométrica para Operações Críticas
> **Origem:** Diário 09/06 / Roadmap_Sensores (item 8 promovido) · **Complexidade:** Baixa-média
> **Depende de:** TASK-0609-A, B concluídas · **PRÉ-REQUISITO para:** TASK-0609-D
>
> Gate biométrico com `termux-fingerprint` antes de operações sensíveis. Essencial antes de liberar multi-IA.

- [ ] Criar `Scripts/core/biometric_gate.sh`
  ```bash
  # resultado=$(termux-fingerprint -t "Autorizar: $1") 
  # verificar: auth_result == AUTH_RESULT_SUCCESS
  # retornar código 0 (ok) ou 1 (negado)
  ```
- [ ] Definir lista definitiva de operações protegidas:
  - `git push` — exfiltração de código
  - `sms-send` — custo/privacidade
  - Qualquer write em `00_Sistema/` — integridade do sistema
  - Acesso de leitura ao `.env` via ferramenta
  - `factory_reset`, `delete_file` em massa
- [ ] Integrar gate no `dispatch.js` como middleware pré-execução de tools críticas
  - Adicionar campo `"requires_biometric": true` em tools sensíveis no `tool_registry.json`
  - Dispatcher verifica esse campo antes de executar
- [ ] Integrar no `android_bridge.js` como middleware para rotas WRITE
- [ ] Testar fluxo completo: comando → prompt biométrico Android → AUTH_SUCCESS → execução
- [ ] Testar rejeição: AUTH_FAIL → log no `android-bridge-audit.log` → retorno 403
- [ ] Atualizar `00_Sistema/seguranca.md` com a 7ª camada: **Biometria**
- [ ] Commit: `feat: biometric gate termux-fingerprint para operacoes criticas`

### TASK-0609-D · Multi-IA via MCP — Arquitetura de Colaboração
> **Origem:** Diário 09/06 · **Complexidade:** Alta · **Impacto:** Arquitetural
> **Depende de:** TASK-0609-C concluída · **Sub-fases:** Design → Canal → Protocolo → Teste
>
> Claude + Antigravity (+ Manus via Ngrok) conversando e colaborando no mesmo workspace.
> Uma IA planeja, a outra executa. Ambas orquestradas pelo workspace_agent local.

#### Fase Design (fazer antes de implementar)
- [ ] Criar `01_Planejamento/Plano_MultiIA_Colaboracao_v1.md` — documento de arquitetura
  - Modelo de ativação: **IA coordenadora** (Claude) + **IA executora** (Antigravity)
  - Fluxo: Claude recebe tarefa → escreve no canal → Antigravity lê → executa → escreve resultado → Claude sintetiza
  - Definir formato de mensagens: `[timestamp] [IA] [tipo: PLAN|EXEC|RESULT|ASK] [conteúdo]`
  - Definir turn-taking: lock otimista por flag `"locked_by"` no canal
- [ ] Criar `01_Planejamento/multiia_channel.md` — nota fixa de canal inter-IA
  - Header com estado: `Status: IDLE | ACTIVE | WAITING`
  - Seção `## Thread Ativa` para troca de mensagens
  - Seção `## Histórico` para log das interações
- [ ] Definir como IAs detectam presença de outras:
  - Estratégia: MCP sessions count via `mcp_status` tool + flag `"ia_conectadas"` no canal

#### Fase Implementação
- [ ] Adicionar tool `channel_read` e `channel_write` ao `tool_registry.json`
  - `channel_read`: lê `01_Planejamento/multiia_channel.md`
  - `channel_write`: append atômico com lock simples (flag + timeout 30s)
- [ ] Adicionar `workspace_agent` como ferramenta auxiliar compartilhada entre IAs
  - Ambas as IAs podem chamar o agente local para micro-tarefas durante colaboração
- [ ] Implementar detecção de presença de IAs no `mcp_server.js`
  - Endpoint: `GET /mcp/sessions` → lista IAs conectadas por token
- [ ] Definir limites de segurança: operações multi-IA requerem biometria do Guilherme
  - Nenhuma ação de WRITE em produção sem gate biométrico
- [ ] Testar sessão colaborativa real:
  - Tarefa definida: "Auditar tool_registry e sugerir 3 novos sinônimos"
  - Claude planeja → Antigravity lê o arquivo → ambas escrevem no canal → Guilherme valida
- [ ] Documentar protocolo final em `02_Memoria/decisoes_tecnicas.md`
- [ ] Commit: `feat: multi-ia canal colaboracao + channel tools + deteccao presenca`

---

## 🔧 Backlog — Infraestrutura (anterior)

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

### 09/06/2026 — TASK-0609-A
- [x] **tool_registry v2.8.0** · +4 sensor tools: `read_battery`, `read_wifi`, `read_location`, `read_sensors`
- [x] **Sinônimos PT-BR** · battery (21 kw), wifi (26 kw), location (14 kw), sensors (13 kw)
- [x] **Campo `requires_biometric`** · preparação estrutural para TASK-0609-C
- [x] **Fallback dual** · Bridge primária → termux-api → erro padronizado
- [x] **Roadmap_Sensores** · atualizado com estratégia e histórico de versões

### 08/06/2026 — Re-indexação e Git
- [x] **Git Push** · Commit 45adcfb push origin main no GitHub.
- [x] **Cron RAG** · Job agendado ativo no Termux (`0 23 * * * consolidate_rag.js`).
- [x] **Re-indexação RAG** · Guia_Ativacao, estabilizacao_mestre e resumo_06-03 indexados após alinhamento do fallback para NVIDIA.
- [x] **TTS** · Problema de falha silenciosa resolvido. O sistema de voz do Chronos agora está 100% operacional no volume máximo.
- [x] **Limpeza Gemini/Claude** · Removido de agent_rules, cloud_bridge, bot.js e .env.
- [x] **Diagnóstico Massivo v3** · 45 sensores mapeados, 37 APIs Termux, stack validado.

### 05/06/2026 — Diagnóstico Massivo v2
- [x] **Stack 7/7 validado** · llama-server, MCP, workspace_agent, API REST, agente local, bridge, hub_pwa — todos ONLINE.
- [x] **Intent routing 8/8** · todos os TOOL_CALL intents roteando `tool_direct` corretamente.
- [x] **Bridge READ validada** · battery (75%, CHARGING, 28°C) + wifi (Família Moreno, 351Mbps) funcionando.
