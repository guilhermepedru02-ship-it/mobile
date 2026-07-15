# Estratégia de Sensores — Workspace Mobile

**Data:** 2026-06-09
**Versão:** v1.0
**Origem:** TASK-0609-A — Expansão tool_registry v2.8.0

---

## Sensores Priorizados (tool_registry v2.8.0)

### 🟢 Implementados e Ativos

| Tool ID | Sensor / API | Prioridade | Motivo |
|---|---|---|---|
| `read_battery` | `termux-battery-status` + Bridge `/bridge/read/battery` | **Imediato** | Alta demanda de linguagem natural ("bateria tá boa?") |
| `read_wifi` | `termux-wifi-connectioninfo` + Bridge `/bridge/read/wifi` | **Imediato** | Diagnóstico de conectividade frequente |
| `read_location` | `termux-location` + Bridge `/bridge/read/location` | **Imediato** | Geofencing futuro + contexto espacial |
| `read_sensors` | `termux-sensor` (light, prox, acc) | **Imediato** | Base para automação contextual |

### 🟡 Próxima Rodada (após validação de 7 dias)

| Sensor | API | Caso de Uso |
|---|---|---|
| Câmera | `termux-camera-photo` | OCR, visão computacional, segurança visual |
| Microfone | `termux-microphone-record` | Assistente por voz (STT → IA → TTS) |
| Infravermelho | `termux-infrared-transmit` | Controle de TV/AC/ventilador por voz |
| Notificações | `termux-notification` | Alertas proativos do sistema |
| Vibração | `termux-vibrate` | Feedback háptico em eventos críticos |
| Clipboard | `termux-clipboard-get/set` | Integração com workflow de texto |

---

## Arquitetura de Fallback dos Sensores

Cada tool de sensor usa estratégia dual:

```
1. Android Bridge (porta 4444) — primário, token-auth, auditado
   ↓ (se offline)
2. termux-api direta — fallback, sem autenticação, sem audit log
   ↓ (se unavailable)
3. JSON de erro padronizado — nunca falha silenciosamente
```

Exemplo de comando `read_battery`:
```bash
curl -s -H 'Authorization: Bearer $BRIDGE_TOKEN_CLAUDE' \
  http://127.0.0.1:4444/bridge/read/battery \
  || termux-battery-status \
  || echo '{"error": "bridge offline, termux-api nao disponivel"}'
```

---

## Cobertura de Linguagem Natural (PT-BR)

Cada sensor cobre variações coloquiais do português brasileiro:

**Bateria** (21 variantes):
- Formais: `bateria`, `carga`, `nível bateria`, `status bateria`
- Coloquiais: `quanto ta a bateria`, `bateria ta boa`, `ta na tomada`, `plugado`
- Perguntas: `ta carregando`, `descarregando`, `bateria fraca`, `bateria cheia`

**WiFi** (26 variantes):
- Formais: `wifi`, `ssid`, `rssi`, `mbps`, `ip local`
- Coloquiais: `to conectado`, `tem internet`, `net ta boa`, `velocidade da net`
- Técnicas: `ping`, `latencia`, `download`, `upload`, `intensidade sinal`

**Localização** (14 variantes):
- `onde estou`, `minha localizacao`, `gps`, `coordenadas`, `posicao atual`

**Sensores** (13 variantes):
- `sensor de luz`, `esta escuro`, `luminosidade`, `acelerometro`, `proximidade`

---

## Campo `requires_biometric`

Preparação para TASK-0609-C (Gate Biométrico):

| Tool | `requires_biometric` | Justificativa |
|---|---|---|
| `read_battery` | `false` | Dado não sensível |
| `read_wifi` | `false` | Dado não sensível |
| `read_location` | `false` | Sensível mas depende de contexto |
| `read_sensors` | `false` | Dados agregados não sensíveis |
| (futuro) `git_push` | `true` | Exfiltração de código |
| (futuro) `sms_send` | `true` | Custo e privacidade |
| (futuro) `delete_file` massa | `true` | Operação destrutiva |

> **Nota:** `read:location` deve ser promovido para `requires_biometric: true` quando integrado a geofencing automatizado. No uso manual via Telegram, `false` é aceitável.

---

## Histórico de Versões do tool_registry

| Versão | Data | Mudanças |
|---|---|---|
| v2.5.0 | 2026-05-31 | Keywords Unicode completas PT-BR |
| v2.7.2 | 2026-06-02 | `list_cerebro` adicionado |
| **v2.8.0** | **2026-06-09** | **+4 sensor tools: battery, wifi, location, sensors** |
