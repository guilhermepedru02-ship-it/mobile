# Regras de Segurança do Workspace

## Camada 1: MCP Gatekeeper (State-Lock)
O servidor MCP inicia toda sessão em estado **TRAVADO**. Qualquer tentativa de ação (criar arquivo, rodar comando, listar pasta) será bloqueada até que a IA execute um `read_file` no arquivo `Cerebro/00_Sistema/README.md`.
- **Timeout de Inatividade:** Se a IA ficar 30 minutos sem enviar ações, o ambiente trava novamente automaticamente.
- **Auditoria:** Todas as tentativas bloqueadas são registradas em `Logs/executor-audit.log` com a tag `[BLOCKED]`.

## Camada 2: Sandbox de Filesystem (Anti-Path Traversal)
Todos os caminhos de arquivo são resolvidos dentro de `/storage/emulated/0/Workspace/`. Qualquer tentativa de acessar `../` ou caminhos absolutos fora dessa raiz será bloqueada com `SECURITY ALERT`.

## Camada 3: Blacklist de Comandos Shell
Os seguintes padrões são bloqueados automaticamente via regex no `executor.js`:

| Padrão | Risco |
|---|---|
| `rm -rf /` | Destruição da raiz do sistema |
| `chmod 777` | Permissões universais perigosas |
| Fork bombs (`:(){...}`) | Consumo infinito de recursos |
| `dd if=` | Escrita raw em disco |
| `mkfs` | Formatação de partições |
| `reboot` / `shutdown` | Desligamento forçado do dispositivo |
| `su` / `sudo` | Escalação de privilégio |
| `pkill termux` | Matar o próprio ambiente de execução |
| `> /dev/sd*` | Escrita direta em dispositivos de bloco |
| `curl \| bash` | Download e execução remota não auditada |

## Camada 4: Proteção de Diretórios
- `delete_file` não permite deletar pastas inteiras, apenas arquivos individuais.
- Isso impede que um agente rogue apague recursivamente conteúdo crítico.

## Camada 5: Limites Operacionais
- **Timeout de Comando:** 60 segundos por operação shell.
- **Buffer Máximo de stdout:** 10MB por comando.

## Camada 6: Auditoria Total
Toda ação executada (com sucesso ou falha) é registrada imutavelmente em `Logs/executor-audit.log` com timestamp UTC e tipo da operação.

# Camada 7: [[Guia_Agente_DevTools_v2.2]]