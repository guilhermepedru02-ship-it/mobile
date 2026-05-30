# Plano de Projeto: Agente MCP de Projetos / DevTools (v1.0)

Este documento descreve a implementação de uma segunda camada de inteligência no Workspace Mobile, focada em automação de engenharia de software e ferramentas de desenvolvimento.

## 1. Visão Geral
O objetivo é expandir as capacidades do `executor.js` e do `mcp_server.js` para permitir que agentes de IA realizem operações de ciclo de vida de software (Git, Build, Test, Deploy) diretamente no ambiente Android/Termux.

## 2. Arquitetura Proposta
O Agente DevTools operará como uma extensão do servidor MCP atual ou como um segundo servidor na porta `3002`, compartilhando o `auth_middleware.js`.

### Novas Operações Homologadas (executor.js)
| Operação | Parâmetros | Descrição |
| :--- | :--- | :--- |
| `git_action` | `action`, `args` | Executa comandos git (status, add, commit, push, pull, log). |
| `npm_action` | `command`, `args` | Gerencia pacotes e scripts (install, test, build). |
| `python_exec` | `script_path`, `args` | Executa scripts Python em ambiente isolado. |
| `lint_check` | `path`, `type` | Roda ferramentas de linting (eslint, pylint). |
| `project_init` | `template`, `name` | Inicializa novas estruturas de projeto baseadas em templates. |

## 3. Implementação Técnica

### Fase 1: Expansão do Executor
*   Atualizar o `executor.js` para incluir os novos casos no switch de ações.
*   Implementar validação rigorosa (whitelist) para comandos Git e NPM para evitar injeção de comandos.

### Fase 2: Integração MCP
*   Registrar as novas ferramentas no `mcp_server.js`.
*   Atualizar o `inputSchema` para refletir os novos parâmetros das ferramentas DevTools.

### Fase 3: Segurança e Isolamento
*   Garantir que as operações Git e NPM respeitem a raiz do Workspace.
*   Implementar timeout específico para operações de build (ex: 300s).

## 4. Protocolo de Co-Coding (DevTools)
1.  **Agente solicita status:** `git_action(action='status')`.
2.  **Agente propõe mudança:** `create_file` ou `edit_file`.
3.  **Agente valida:** `npm_action(command='test')`.
4.  **Agente persiste:** `git_action(action='commit', args=['-m', 'feat: ...'])`.

## 5. Próximos Passos
1.  Salvar este plano em `Cerebro/01_Planejamento/Plano_Agente_DevTools_v1.md`.
2.  Iniciar a modificação do `executor.js`.
3.  Testar comando `git status` via Manus.
