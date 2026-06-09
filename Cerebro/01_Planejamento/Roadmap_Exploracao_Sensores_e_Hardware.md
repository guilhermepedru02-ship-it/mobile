# Roadmap de Exploração Profunda — Sensores, Hardware e Automação

**Data:** 2026-06-08
**Origem:** Diagnóstico Massivo v3 (Claude Opus 4.6 via MCP)
**Escopo:** Projetos de média e baixa prioridade que exploram as 37 APIs e 45 sensores do dispositivo

---

## 🟡 PRIORIDADE MÉDIA — Evolução da Plataforma

### 1. 💡 Automação IoT com Infravermelho
- **O que:** Usar `termux-infrared-transmit` para controlar TV, ar-condicionado, ventiladores e qualquer dispositivo com receptor IR
- **Como implementar:**
  1. Mapear os códigos IR dos eletrodomésticos (banco público LIRC/IRDB ou captura manual)
  2. Criar um `Scripts/core/ir_controller.js` com funções por dispositivo
  3. Registrar como ferramenta no `tool_registry.json` para acesso do agente
  4. Expor no Hub PWA como controle remoto visual
- **Dependências:** `termux-infrared-frequencies` (disponível), `termux-infrared-transmit` (disponível)
- **Complexidade:** Média — o desafio é mapear os códigos corretos
- **Impacto:** O celular vira controle remoto universal inteligente comandado por voz/IA

### 2. 🌡️ Hub de Monitoramento Ambiental
- **O que:** Dashboard real-time combinando múltiplos sensores para consciência ambiental
- **Sensores utilizados:**
  - `light_ltr569` — luminosidade ambiente (lux)
  - `acc_bma2x2` — vibração/movimento
  - Temperatura da bateria como proxy de temperatura ambiente
  - `Device Orientation` — posição do dispositivo
  - `Step Counter` — atividade física
- **Como implementar:**
  1. `termux-sensor -s "light_ltr569" -d 5000` → streaming contínuo
  2. WebSocket bridge para o Hub PWA
  3. Gráficos de série temporal com Chart.js ou similar
  4. Histórico salvo em SQLite ou JSON rotativo
- **Complexidade:** Média-alta — requer streaming e visualização
- **Impacto:** Base para automação contextual ("está escuro → ligar luz", "parado há 2h → lembrar de se mover")

### 3. 🔔 Sistema de Alertas Inteligentes
- **O que:** IA proativa que combina sensores + notificações + TTS para alertas automáticos
- **Cenários de alerta:**
  - Bateria < 20% → `termux-notification` + `termux-vibrate` + TTS
  - Memória RAM crítica → sugerir encerrar processos
  - Sensor `Pocket mode` + movimento prolongado → sugerir pausa
  - WiFi desconectado → alerta + tentar reconectar
  - Horário programado → briefing diário via TTS
- **Como implementar:**
  1. Cron job leve a cada 5 minutos verificando condições
  2. Motor de regras simples em JSON (condição → ação)
  3. Integração com `termux-notification`, `termux-tts-speak`, `termux-vibrate`
- **Complexidade:** Média — requer TTS funcionando (prioridade alta)
- **Impacto:** Agente que cuida ativamente do usuário e do dispositivo

### 4. 📷 Pipeline de Visão Computacional
- **O que:** Usar câmeras + IA cloud para análise visual programática
- **Casos de uso:**
  - OCR de documentos e notas manuscritas
  - Leitura de QR codes
  - Identificação de objetos/produtos
  - Monitoramento visual de ambiente (segurança)
- **Como implementar:**
  1. `termux-camera-photo -c 0 /path/foto.jpg` → captura
  2. Enviar para NVIDIA NIM com modelo de visão (ou Llama Vision)
  3. Interpretar resultado e tomar ação
- **Dependências:** Modelo de visão na NVIDIA NIM; alternativa: Pillow + tesseract local
- **Complexidade:** Média-alta
- **Impacto:** Digitalização instantânea, segurança visual, leitura automática

### 5. 📱 App Nativo Android (Plano Mestre)
- **O que:** Interface nativa substituindo o Bot Telegram como interface primária
- **Fases:**
  - **Fase 1:** Interface nativa com comunicação via API REST (4000)
  - **Fase 2:** SQLite local para persistência + histórico de conversas
  - **Fase 3:** Widgets Android para acesso rápido
- **Complexidade:** Alta
- **Impacto:** UX premium, independência total do Telegram, offline-first

---

## 🟢 PRIORIDADE BAIXA — Expansão Futura

### 6. 🎙️ Assistente por Voz Completo
- **O que:** Loop completo STT → IA → TTS para interação hands-free
- **Pipeline:**
  1. `termux-microphone-record -f /path/audio.wav -l 10` → captura
  2. Whisper local (se caber na RAM) ou API de STT → texto
  3. Qwen local ou NVIDIA NIM → raciocínio
  4. `termux-tts-speak` → resposta falada
- **Desafio:** Whisper consome muita RAM; precisaria de offloading para cloud STT
- **Complexidade:** Alta
- **Impacto:** Assistente conversacional completo, mãos livres

### 7. 📍 Geofencing e Automação por Localização
- **O que:** Ações automáticas baseadas em posição GPS
- **Cenários:**
  - Chegar em casa → ligar WiFi, ativar perfil noturno
  - Sair de casa → verificar tarefas pendentes, briefing
  - Entrar no trabalho → silenciar, modo foco
- **Como:** `termux-location` polling periódico → comparar com coordenadas salvas → trigger
- **Complexidade:** Média
- **Impacto:** Automação contexto-espacial

### 8. 🔐 Segurança Biométrica para Ações Críticas
- **O que:** `termux-fingerprint` como gate para operações sensíveis
- **Ações protegidas:** git push, sms-send, alterações em 00_Sistema, acesso a .env
- **Como:** Wrapper que chama `termux-fingerprint` e só prossegue se `auth_result: AUTH_RESULT_SUCCESS`
- **Complexidade:** Baixa-média
- **Impacto:** Segurança robusta sem senhas

### 9. 🎵 Controle de Mídia Inteligente
- **O que:** Controle contextual de música/podcast via gestos e IA
- **Sensores:** ChopChop (agitar), Flip (virar), `termux-volume`, `termux-media-player`
- **Cenários:**
  - Virar o celular = pausar música
  - ChopChop = próxima faixa
  - Volume auto-ajustado por ambiente (sensor de luz como proxy de local)
- **Complexidade:** Média
- **Impacto:** Experiência de mídia gestual e contextual

---

## 📊 Matriz de Dependências

| Projeto | Depende de | APIs Utilizadas |
|---|---|---|
| IoT Infravermelho | — | infrared-transmit, infrared-frequencies |
| Hub Ambiental | — | sensor, battery-status |
| Alertas Inteligentes | TTS fix | notification, vibrate, tts-speak, battery |
| Visão Computacional | NVIDIA Vision model | camera-photo, (cloud API) |
| App Nativo | — | todas (via API REST 4000) |
| Assistente por Voz | TTS fix + STT | microphone-record, tts-speak |
| Geofencing | — | location, wifi-enable |
| Segurança Biométrica | — | fingerprint |
| Controle de Mídia | — | sensor, media-player, volume |

> **Todos os projetos utilizam APIs já disponíveis no dispositivo. Nenhum requer instalação adicional de hardware.**
