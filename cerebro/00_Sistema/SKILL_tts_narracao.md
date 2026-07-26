# SKILL: Narração TTS para IAs Externas via MCP

**Versão:** 1.0.0 · **Data:** 2026-06-09
**Origem:** TASK-0609-B · **Escopo:** IAs externas (Claude, Antigravity) via MCP workspace-telemovel

---

## Objetivo

Permitir que IAs externas conectadas via MCP narrem suas ações em tempo real através do TTS do dispositivo Android.
O usuário ouve o que a IA está fazendo sem precisar ler a tela.

---

## Quando Usar TTS (Protocolo Obrigatório)

| Evento | Obrigatório? | Exemplo de Fala |
|---|---|---|
| Início de diagnóstico | ✅ SIM | `"Claude: Iniciando diagnóstico do sistema"` |
| Leitura do Gatekeeper | ✅ SIM | `"Claude: Protocolo Gatekeeper ativo, lendo sistema"` |
| Operação crítica (write, commit, delete) | ✅ SIM | `"Claude: Executando commit no repositório"` |
| Resultado de ferramenta (sucesso/falha) | ✅ SIM | `"Claude: Tool registry atualizado com sucesso"` |
| Cada passo de implementação | ⚠️ OPCIONAL | `"Claude: Criando arquivo de permissões"` |
| Perguntas simples de leitura | ❌ NÃO | (evitar verbosidade excessiva) |

---

## Formato de Mensagem

```
[IA]: [ação em curso] — [resultado esperado ou obtido]
```

**Exemplos:**
- `"Claude: Lendo tool_registry — verificando versão atual"`
- `"Claude: Adicionando sinônimos de bateria — vinte e uma keywords PT-BR"`
- `"Claude: Commit realizado — TASK-0609-A concluída"`
- `"Antigravity: Executando testes — aguardando resultado"`

**Regras:**
- Máximo 15 palavras por mensagem TTS (tempo de fala razoável)
- Sempre incluir o nome da IA no início
- Usar PT-BR coloquial e direto
- **NÃO bloquear** a execução — sempre fire-and-forget

---

## Implementação: Como Chamar o TTS

### Via MCP (tool execute_workspace_action)

```json
{
  "actions": [{
    "type": "run_command",
    "command": "curl -s -X POST -H 'Content-Type: application/json' -H 'Authorization: Bearer $BRIDGE_TOKEN_CLAUDE' -d '{\"text\": \"Claude: iniciando diagnostico\"}' http://127.0.0.1:4444/bridge/write/tts &"
  }]
}
```

> **Nota crítica:** O `&` ao final torna o curl assíncrono (fire-and-forget).
> O MCP não espera a resposta do TTS — a execução continua imediatamente.

### Via Shell Direto

```bash
# Fire-and-forget (não bloqueia)
curl -s -X POST \
  -H 'Authorization: Bearer $BRIDGE_TOKEN_CLAUDE' \
  -H 'Content-Type: application/json' \
  -d '{"text": "Claude: operacao concluida"}' \
  http://127.0.0.1:4444/bridge/write/tts &

# Alternativa direta (sem bridge, bloqueante)
termux-tts-speak "Claude: operacao concluida"
```

### Fallback

```bash
# 1º: Android Bridge (auditado, token-auth)
curl -s ... http://127.0.0.1:4444/bridge/write/tts &

# 2º: termux-tts-speak direto (sem audit, sem auth)
termux-tts-speak "mensagem" &

# 3º: Silencioso (não falhar)
echo "TTS indisponível" >&2 || true
```

---

## Escopo no bridge_permissions.json

Verificado em 2026-06-09 — `write:tts` já ativo para:
- ✅ `claude` (trust_tier: cloud)
- ✅ `antigravity` (trust_tier: local)
- ✅ `qwen_local` (trust_tier: local)
- ❌ `gemini` (escopo mínimo — não tem `write:tts`)

---

## Latência Esperada

| Etapa | Tempo estimado |
|---|---|
| curl para bridge | ~5ms |
| Bridge valida token + escopo | ~2ms |
| `termux-tts-speak` iniciar | ~200–500ms |
| Síntese de voz (frase curta) | ~500ms–2s |
| **Total percebido pelo usuário** | **~700ms–2.5s** |

> A execução da IA não espera esse tempo — o `&` garante que o fluxo principal continue.

---

## Exemplo de Sessão Narrada (Claude via MCP)

```
[Claude conecta via MCP]
🔊 "Claude: protocolo Gatekeeper ativo, lendo sistema"

[Lê README, system_prompt, kanban]
🔊 "Claude: contexto carregado, iniciando TASK-0609-B"

[Cria SKILL_tts_narracao.md]
🔊 "Claude: skill de narração criada"

[Atualiza system_prompt.md]
🔊 "Claude: system prompt atualizado com protocolo TTS"

[Faz commit]
🔊 "Claude: commit realizado, TASK-0609-B concluída"
```

---

## Palavras-chave para Indexação RAG
#tts #narracao #ias-externas #mcp #voice #fire-and-forget #bridge-tts #skill
