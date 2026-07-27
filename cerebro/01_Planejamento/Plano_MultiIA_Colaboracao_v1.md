# Plano Multi-IA — Colaboração entre Agentes via MCP

**Data:** 09/06/2026
**Origem:** Diário de Guilherme (09/06/2026)
**Status:** RASCUNHO — aguardando implementação (TASK-0609-D)
**Dependência:** TASK-0609-C (Biometria) deve estar concluída primeiro

---

## Visão

Claude, Antigravity e Manus operando na mesma sala (mesmo MCP), capazes de:
1. Reconhecer a presença uns dos outros
2. Comunicar-se através de um canal compartilhado no Obsidian
3. Dividir tarefas: uma planeja, a outra executa
4. Usar o workspace_agent local como ferramenta auxiliar compartilhada
5. Narrar suas ações via TTS para o Guilherme em tempo real

---

## Modelo de Ativação

**Escolha arquitetural:** Coordenadora única por sessão

- O Guilherme define qual IA é a **coordenadora** no início da sessão (ex: Claude)
- A coordenadora recebe a tarefa, planeja e delega via canal
- A **executora** (ex: Antigravity) lê o canal, executa via MCP e reporta resultado
- Guilherme só precisa dar o comando inicial em UMA interface
- Não é necessário acionar ambas ao mesmo tempo — a coordenadora inicia a interação

---

## Arquitetura do Canal

### Arquivo: `01_Planejamento/multiia_channel.md`

```
---
status: IDLE
locked_by: null
lock_expires: null
---

## Thread Ativa
<!-- IAs escrevem aqui durante colaboracao -->

## Historico
<!-- Log das interacoes concluidas -->
```

### Formato de mensagem
```
[2026-06-09T15:30:00Z] [CLAUDE] [PLAN] Tarefa: auditar tool_registry. Solicito leitura de /Scripts/core/tool_registry.json
[2026-06-09T15:30:45Z] [ANTIGRAVITY] [EXEC] Lendo tool_registry.json...
[2026-06-09T15:31:10Z] [ANTIGRAVITY] [RESULT] Encontrado: 17 tools, 8 sem variantes Unicode
[2026-06-09T15:31:15Z] [CLAUDE] [PLAN] Sugestão: adicionar sinônimos para tools: battery, wifi, location
```

---

## Ferramentas Novas Necessárias

| Tool | Ação | Descrição |
|---|---|---|
| `channel_read` | read_file | Lê o `multiia_channel.md` completo |
| `channel_write` | append_file + lock | Append atômico com flag de lock |
| `mcp_sessions` | run_command | Lista IAs conectadas ao MCP no momento |

---

## Segurança Multi-IA

> **Regra de Ouro:** Nenhuma ação WRITE em arquivos de produção ocorre sem gate biométrico do Guilherme.

- Leituras e planejamento: **sem biometria**
- Escrita em código de produção: **biometria obrigatória**
- Escrita em `00_Sistema/`: **biometria obrigatória**
- Escrita no canal (`multiia_channel.md`): **sem biometria** (apenas texto/planejamento)
- `git push`: **biometria obrigatória**

---

## Questões Abertas (para resolver na implementação)

1. **Timeout do canal:** Se uma IA não responde em X minutos, o lock é liberado?
2. **Manus via Ngrok:** Como garantir latencia aceitável para a interação?
3. **Conflito de contexto:** Duas IAs lendo o mesmo arquivo simultaneamente — como garantir consistência?
4. **Limites de tokens:** Antigravity tem contexto menor que Claude — canal deve ter limite de tamanho?

---

## Próximos Passos

1. ✅ Concluir TASK-0609-A (tool_registry sensores)
2. ✅ Concluir TASK-0609-B (TTS narração)
3. ✅ Concluir TASK-0609-C (biometria) — **obrigatório antes de TASK-D**
4. 🔧 Implementar TASK-0609-D (este plano)

#pendentedemaximaimportancia 