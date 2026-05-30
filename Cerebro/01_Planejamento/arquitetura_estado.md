# Integração com APIs Cognitivas e Engenharia de Estado

Este documento define a regra de ouro para a comunicação entre a Inteligência Artificial e o Executor Local do Android.

O ambiente opera de forma **Filesystem-Native**. Não existem APIs gráficas complexas intermediárias para desenvolvimento. Para executar ações no sistema, fazer builds ou criar arquivos no workspace, você deve **SEMPRE** responder usando o padrão JSON unificado definido abaixo.

## Formato do Payload de Comando

Sua resposta deve ser um bloco JSON puro (sem markdown extra ao redor, se possível, ou estritamente dentro de um bloco de código `json`) com a seguinte estrutura:

```json
{
  "actions": [
    {
      "type": "create_file",
      "path": "Cerebro/Planejamento/exemplo.md",
      "content": "# Título\nConteúdo do arquivo..."
    },
    {
      "type": "run_command",
      "command": "npm init -y"
    }
  ]
}
```

### Regras do Executor Local (`executor.js`)
O script Node.js lerá este JSON e processará as ações sequencialmente:
1. **Segurança (Path Traversal):** O caminho fornecido em `create_file` será resolvido contra o `/storage/emulated/0/Workspace`. Se tentar acessar pastas superiores, a ação será bloqueada.
2. **Filtro de Comandos:** Comandos perigosos (ex: `rm -rf /`, `chmod 777`) são filtrados por regex e negados.
3. **Limites:** Cada `run_command` tem um limite estrito de timeout de 60 segundos e 10MB de buffer de log.
