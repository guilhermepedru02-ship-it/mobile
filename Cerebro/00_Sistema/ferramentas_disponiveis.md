# Catálogo de Ferramentas do Executor

> A ferramenta unificada é chamada via `execute_workspace_action` através do servidor MCP `workspace-executor`. A IA deve enviar o comando usando um array de ações dentro de um payload JSON. Caminhos de arquivos devem ser relativos à raiz do Workspace (ex: `Cerebro/...`).

## create_file
**Descrição:** Cria um arquivo novo ou sobrescreve um existente.
```json
{ "type": "create_file", "path": "Cerebro/exemplo.md", "content": "# Título" }
```

## read_file
**Descrição:** Lê o conteúdo completo de um arquivo.
```json
{ "type": "read_file", "path": "Cerebro/exemplo.md" }
```

## append_file
**Descrição:** Adiciona conteúdo ao final de um arquivo existente sem apagar o que já estava nele.
```json
{ "type": "append_file", "path": "Cerebro/04_Diario/2026-05-27.md", "content": "\n- Nova entrada" }
```

## list_dir
**Descrição:** Lista todos os arquivos e subpastas de um diretório.
```json
{ "type": "list_dir", "path": "Cerebro/" }
```

## delete_file
**Descrição:** Remove um arquivo específico. Esta operação não deleta pastas (apenas arquivos individuais) como medida de segurança.
```json
{ "type": "delete_file", "path": "Cerebro/lixo.txt" }
```

## move_file
**Descrição:** Move ou renomeia um arquivo ou diretório de um local para outro.
```json
{ "type": "move_file", "source": "Cerebro/rascunho.md", "destination": "Cerebro/02_Memoria/final.md" }
```

## file_info
**Descrição:** Retorna metadados de um arquivo, como tamanho (bytes) e datas de criação/modificação.
```json
{ "type": "file_info", "path": "Cerebro/00_Sistema/README.md" }
```

## search_files
**Descrição:** Faz uma busca por uma string de texto dentro de todos os arquivos do diretório especificado.
```json
{ "type": "search_files", "path": "Cerebro/", "query": "IA", "recursive": true }
```

## run_command
**Descrição:** Executa um comando shell no Termux. Timeout máximo de 60 segundos por operação.
```json
{ "type": "run_command", "command": "npm run build" }
```

# busca vetorial local

- `index_cerebro`: Uma função autônoma que engatilha a reindexação global das anotações em disco.
- `semantic_search`: Recebe um parâmetro `query` (ex: "preferências de segurança") e retorna as 5 passagens de texto mais relevantes em questão de milissegundos


> ⚠️ **Segurança Anti-Destruição:** Comandos como `rm -rf /`, modificações de permissão (chmod 777), shutdown ou acessos a caminhos fora do Workspace (Path Traversal) são instantaneamente bloqueados pelo backend de execução. Todas as falhas de permissão geram auditoria.