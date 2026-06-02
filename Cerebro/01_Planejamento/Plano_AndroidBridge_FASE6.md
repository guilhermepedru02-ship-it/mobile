# Plano de Integração Android Bridge — FASE 6
**Data:** 2026-06-01  
**Status:** Planejamento Ativo — Pré-implementação  
**Autor:** Claude Sonnet 4.6 via MCP  
**Versão:** 1.0.0

> ⚠️ **REGRA DE OURO DESTA FASE:** Segurança é pré-requisito absoluto. Nenhum componente da bridge é implementado antes que sua camada de segurança correspondente esteja concluída e validada. A ordem é inviolavel: **Segurança → Implementação → Teste → Documentação.**

---

## Visão Geral

Construir uma ponte segura entre IAs externas (Claude, Antigravity, Gemini), o Workspace Mobile e apps do Android, expondo dados e capacidades do dispositivo como rotas HTTP controladas. Esta bridge é o fundamento do **Milestone 4 redesenhado**: não apenas um app de chat, mas um hub de orquestração onde o usuário, as IAs e o Android interagem de forma soberana e auditada.

---

## Arquitetura Alvo

```
┌───────────────────────────────────────────────────┐
│  IAs EXTERNAS (Claude, Antigravity, Gemini)          │
│  Acessam via MCP ou HTTP autenticado                 │
└─────────────────────────┬────────────────────────┘
                         │
                         ▼
┌───────────────────────────────────────────────────┐
│         ANDROID BRIDGE GATEWAY (porta 4444)          │
│  • Autenticação Bearer Token (por IA, por sessão)   │
│  • Autorização por escopo (o que cada IA pode)      │
│  • Rate limiting por cliente                         │
│  • Auditoria total (quem pediu o quê, quando)        │
│  • Whitelist de operações permitidas                 │
└───────────────────────┬───────────────────────────┘
            │                       │
     ▼                   ▼
┌───────────────┐  ┌───────────────────┐
│ termux-api     │  │ termux-am (intents) │
│ (sensores,     │  │ abrir apps,         │
│  SMS, clips,   │  │ compartilhar,       │
│  localização,  │  │ broadcasts          │
│  notificações) │  └───────────────────┘
└───────────────┘
```

---

## Pré-requisito único antes de qualquer implementação

Instalar o `termux-api` no Termux E o app **Termux:API** da Play Store:
```bash
pkg install termux-api
```
Sem isso, toda a Camada 2 (sensores, SMS, áudio, localização) é inacessível.

---

## FASE 6.0 — Camada de Segurança (obrigatória antes de qualquer bridge)

### 6.0.1 — Sistema de Escopos por IA

Cada IA recebe um token único e um conjunto de escopos fixos. Não é negociável em runtime.

```json
// bridge_permissions.json
{
  "identities": {
    "claude": {
      "token_env": "BRIDGE_TOKEN_CLAUDE",
      "scopes": ["read:battery", "read:location", "read:clipboard",
                 "write:notification", "write:clipboard", "intent:open_app"],
      "rate_limit": { "requests_per_minute": 10, "requests_per_day": 100 }
    },
    "antigravity": {
      "token_env": "BRIDGE_TOKEN_ANTIGRAVITY",
      "scopes": ["read:battery", "read:wifi"],
      "rate_limit": { "requests_per_minute": 5, "requests_per_day": 50 }
    },
    "gemini": {
      "token_env": "BRIDGE_TOKEN_GEMINI",
      "scopes": ["read:battery"],
      "rate_limit": { "requests_per_minute": 3, "requests_per_day": 30 }
    }
  }
}
```

**Princípio:** Claude  e Antigravity tem mais escopos porque é a IA principal de desenvolvimento. Gemini API e Manus IA têm escopos mínimos até que confiança seja estabelecida em produção.
O Jason acima representa um exemplo de como isso deve ser feito, ainda é necessário a confirmação do usuário sobre o que cada IA poderá fazer. Depois disso todo o procedimento é gravado na memória para implementação 

### 6.0.2 — Operações Proibidas (Blacklist Absoluta)

Independente de escopo, token ou IA, estas operações são BLOQUEADAS em hardcode:

| Operação | Motivo |
|---|---|
| `termux-sms-send` | Enviar SMS sem confirmação do usuário |
| `termux-call` | Fazer chamadas telefônicas |
| `termux-camera-photo` | Capturar imagem sem consentimento explícito |
| `termux-microphone-record` | Gravar áudio sem consentimento |
| `termux-contact-list` | Expor lista de contatos a IAs externas |
| `am broadcast` para apps externos | Broadcasts não auditados |
| Qualquer intent com `FLAG_GRANT_*` | Escalada de permissão |
| Acesso a `/storage/emulated/0/Android/data/` | Dados internos de apps |

### 6.0.3 — Operações com Confirmação Obrigatória

Estas operações requerem confirmação explícita do Guilherme antes de executar:

| Operação | Mecanismo de Confirmação |
|---|---|
| `write:clipboard` | Notificação Android + timeout 30s |
| `intent:open_app` | Mensagem Telegram + botão Sim/Não |
| `write:notification` | Log em auditoria + preview do conteúdo |
| SMS (se desbloqueado no futuro) | Confirmação dupla via Telegram |

### 6.0.4 — Auditoria da Bridge

Todo request à bridge gera entrada imutável em `Logs/android-bridge-audit.log`:
```
[2026-06-01T22:00:00Z] IA=claude SCOPE=read:battery OP=termux-battery-status STATUS=OK
[2026-06-01T22:00:01Z] IA=antigravity SCOPE=write:notification OP=DENIED reason=escopo_nao_autorizado
```

### 6.0.5 — Kill Switch

Rota dedicada para desligar a bridge instantaneamente sem reiniciar o sistema:
```bash
curl -X POST http://127.0.0.1:4444/bridge/shutdown \
  -H "X-Owner-Key: $BRIDGE_OWNER_KEY"
```
Apenas o `BRIDGE_OWNER_KEY` (variável exclusiva de Guilherme, nunca exposta a IAs) pode acionar isso.

---

## FASE 6.1 — android_bridge.js (implementação)

**Arquivo:** `Scripts/core/android_bridge.js`  
**Porta:** 4444  
**Dependência:** `termux-api` instalado

### Rotas planejadas (Camada READ — implementar primeiro)

```
POST /bridge/battery        ← estado da bateria (nível, status, temperatura)
POST /bridge/wifi           ← rede conectada (SSID, sinal, IP)
POST /bridge/location       ← GPS (lat, long, precisão) — confirmação obrigatória
POST /bridge/clipboard/get  ← lêr área de transferência
POST /bridge/storage/list   ← listar /storage/emulated/0/ (não Android/data/)
POST /bridge/storage/read   ← ler arquivo de pasta compartilhada
```

### Rotas planejadas (Camada WRITE — implementar segundo, após validação da READ)

```
POST /bridge/notification   ← enviar notificação Android
POST /bridge/clipboard/set  ← escrever na área de transferência
POST /bridge/tts            ← text-to-speech
POST /bridge/intent/open    ← abrir app por package name
```

### Rotas NUNCA implementadas
```
/bridge/sms/send    ← BLACKLIST permanente
/bridge/camera      ← BLACKLIST permanente  
/bridge/microphone  ← BLACKLIST permanente
/bridge/contacts    ← BLACKLIST permanente
```

---

## FASE 6.2 — Hub de Comunicação (Milestone 4 Redesenhado)

Uma PWA (Progressive Web App) leve servida pelo próprio Node.js do Termux, acessível pelo browser do Android em `http://127.0.0.1:5555`. Não requer Play Store, funciona offline, acessa workspace_agent e android_bridge diretamente por localhost.

**Funcionalidades:**
- Chat unificado com Claude, Gemini e Qwen local (selecionável)
- Painel de status do sistema (todos os 7 serviços)
- Kanban visual interativo
- Feed de notificações da bridge (o que as IAs acessaram)
- Botões de confirmação para operações write da bridge

---

## Sequência de Implementação

```
[ ] 6.0 — Segurança (bridge_permissions.json + middleware)
[ ] 6.0.1 — Instalar termux-api + Termux:API app
[ ] 6.0.2 — Criar bridge_permissions.json
[ ] 6.0.3 — Implementar middleware de autenticação/escopo
[ ] 6.0.4 — Implementar sistema de auditoria da bridge
[ ] 6.0.5 — Implementar kill switch
[ ] 6.1 — Android Bridge (READ only primeiro)
[ ] 6.1.1 — android_bridge.js com rotas READ
[ ] 6.1.2 — Testes ao vivo com Claude via MCP
[ ] 6.1.3 — Validação de auditoria (verificar logs)
[ ] 6.1.4 — Rotas WRITE com mecanismo de confirmação
[ ] 6.2 — Hub PWA (Milestone 4)
[ ] 6.2.1 — Servidor PWA (porta 5555)
[ ] 6.2.2 — Interface de chat multi-IA
[ ] 6.2.3 — Painel de status + kanban
[ ] 6.2.4 — Feed de auditoria da bridge
[ ] 6.2.5 — Botões de confirmação de operações
```

---

## Princípios de Design Inviolaveis

1. **Zero confiança implícita:** Toda IA é tratada como cliente externo não confiável até prova em contrário.
2. **Princípio do menor privilégio:** Cada IA recebe apenas o mínimo de escopos necessários.
3. **Dados sensíveis nunca saem do dispositivo:** GPS, SMS, contatos são ou bloqueados ou requerem confirmação explícita.
4. **Auditabilidade total:** Todo acesso é registrado. Guilherme pode revisar o que cada IA fez a qualquer momento.
5. **Kill switch instantâneo:** A bridge pode ser desligada em um comando sem derrubar o resto do sistema.
6. **READ antes de WRITE:** As rotas de leitura são validadas em produção por pelo menos uma semana antes de qualquer rota de escrita ser implementada.

---

## Arquivos a Criar na Implementação

```
Scripts/core/android_bridge.js          ← servidor principal (porta 4444)
Scripts/core/bridge_permissions.json    ← escopos por IA
Scripts/core/bridge_middleware.js       ← auth + escopo + rate limit
Scripts/core/bridge_audit.js           ← log imutável
Projetos/hub_pwa/                       ← PWA do hub
  index.html
  app.js
  style.css
  server.js                             ← Express (porta 5555)
```

---

## Integração com o Sistema Existente

A bridge não substitui nenhum componente existente. Ela se adiciona ao stack:

| Porta | Serviço | Papel |
|---|---|---|
| 11434 | llama-server | IA local (inferencia) |
| 3001 | MCP Server | Claude ↔ Workspace |
| 3333 | workspace_agent | Operações de filesystem |
| 4000 | API REST | Endpoints públicos autenticados |
| 4001 | Agente Local | Pipeline Qwen + ferramentas |
| **4444** | **Android Bridge** | **Dados e controle do Android** |
| **5555** | **Hub PWA** | **Interface unificada** |

---

*Plano gerado por Claude Sonnet 4.6 via MCP — 01/06/2026*  
*Próxima ação: instalar termux-api e implementar FASE 6.0 (segurança)*
