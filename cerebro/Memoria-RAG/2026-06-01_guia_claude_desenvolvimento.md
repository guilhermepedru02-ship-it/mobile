# Guia Operacional — Claude como IA Principal de Desenvolvimento

**Data:** 2026-06-01  
**Aplica-se a:** Claude Sonnet via MCP workspace-telemovel e futuras IAs externas (Antigravity, etc.)

---

## Visão Geral

Claude + MCP é o fluxo mais eficiente para desenvolvimento no Workspace Mobile. Não passa pelo Qwen, não depende de cloud fallback, não tem limite de raciocínio. O workspace_agent (3333) fornece os braços, Claude fornece o cérebro.

---

## Protocolo de Início de Sessão (Obrigatório)

```
1. Ler Cerebro/00_Sistema/README.md  ← desbloqueio do Gatekeeper
2. Verificar stack: bash 03_start_services.sh --status
3. Ler arquivos relevantes para a tarefa
4. Executar
```

Claude faz isso automaticamente a cada sessão.

---

## Fluxo de Desenvolvimento Massivo

### Para criar/editar arquivos
```
Claude usa: workspace-telemovel create_file / append_file
Caminhos: SEMPRE relativos ao WORKSPACE_ROOT
Exemplo certo:   Scripts/core/meu_arquivo.js
Exemplo errado:  Workspace/Scripts/core/meu_arquivo.js
```

### Para executar código
```
Claude usa: workspace-telemovel run_command
Alternativa: workspace_agent /shell_exec (porta 3333)
Node: v26.2.0 | NPM: 11.15.0 | Python3 disponível
```

### Para operações de filesystem
```
workspace_agent (3333) — rotas disponíveis:
  POST /read_file   {path}
  POST /write_file  {path, content}
  POST /append_file {path, content}
  POST /delete_file {path}
  POST /move_file   {source, destination}
  POST /list_dir    {path}
  POST /shell_exec  {command}
  POST /run_script  {script_path, args?}
  POST /apply_patch {path, diff}  ← use write_file completo como alternativa mais confiável
```

### Para git
```
Commit: Claude faz via run_command
Push:   SEMPRE manual no Termux (rede externa bloqueada no MCP)
Comando: git -C /storage/emulated/0/Workspace push origin main
```

---

## Economia de Tokens — Práticas

### Use workspace_agent para operações determinísticas
Em vez de mandar um arquivo inteiro para Claude reescrever, use:
1. Claude gera apenas o trecho alterado
2. Aplica via `write_file` (arquivo completo) ou `shell_exec` com `sed`
3. Reduz drasticamente o payload por operação

### Evite paralelismo com o agente local
Se o agente local (4001) estiver ativo, não dispare múltiplos requests simultâneos:
- Qwen bloqueia event loop durante inferência
- MCP pode cair junto por timeout
- Para sessões de desenvolvimento: parar o agente local e usar workspace_agent direto

### Consolide a Memoria-RAG ao fim do dia
```bash
node Scripts/core/consolidate_rag.js
# Transforma wm_*.json do dia em _consolidated.md
# Remove os JSONs individuais automaticamente
```

---

## O Que Claude Enxerga no Sistema

Claude tem visibilidade completa de:
- Estrutura de pastas e arquivos com conteúdo
- Histórico de decisões técnicas (decisoes_tecnicas.md)
- Estado atual dos servicos (via --status)
- Logs de auditoria do agente e executor
- Kanban e memória RAG acumulada
- Versões e changelog de cada componente

Claude NÃO tem acesso a:
- Rede externa (push git, APIs externas)
- .env e chaves (ignorado pelo Gatekeeper de segurança)
- Processos em tempo real do Android (sem acesso ao sistema operacional)

---

## Limites Conhecidos do MCP

| Limite | Contorno |
|---|---|
| Timeout 4min sem resposta | Requests pesados (inferência Qwen) — evitar paralelo |
| Rede externa bloqueada | git push manual no Termux |
| Sem acesso ao .env | Chaves ficam seguras, Claude não pode ler segredos |
| apply_patch frágil | Usar write_file com conteúdo completo |

---

## Workflow Recomendado para Desenvolvimento

```
Início de sessão:
  1. Claude reconecta, lê README, verifica --status
  2. Claude lê kanban para entender contexto
  3. Guilherme descreve a tarefa

Desenvolvimento:
  4. Claude lê arquivos afetados
  5. Claude implementa e salva
  6. Claude testa via shell_exec
  7. Claude commita

Fim de sessão:
  8. Claude atualiza kanban
  9. Claude documenta na Memoria-RAG
  10. Guilherme faz git push no Termux
  11. Guilherme roda: node Scripts/core/consolidate_rag.js
```

---

## Palavras-chave
#claude-mcp #desenvolvimento #workflow #workspace-agent #economia-tokens #protocolo #2026-06-01
