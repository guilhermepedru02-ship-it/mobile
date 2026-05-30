# workspace_agent_server — Protocolo de Payload e Resposta
**Versão:** 1.0.0 | **Data:** 2026-05-30 | **Porta:** 3333 (localhost only)

---

## Visão Geral

O `workspace_agent_server.js` é um servidor HTTP leve rodando em `http://127.0.0.1:3333` que expõe o workspace como ferramenta MCP universal, acessível por qualquer IA externa conectada (Claude, Antigravity, Manus, e futuras IAs).

**Iniciado por:** `Scripts/bootstrap/03_start_services.sh` (serviço [2/5])
**Log:** `Logs/workspace_agent.log`

---

## Rotas Disponíveis

### GET /health
Health check. Não requer body.

**Resposta:**
```json
{
  "ok": true,
  "service": "workspace_agent_server",
  "version": "1.0.0",
  "port": 3333,
  "workspace": "/storage/emulated/0/Workspace",
  "timestamp": "2026-05-30T..."
}
```

### GET /capabilities
Lista todas as rotas disponíveis com seus parâmetros. Útil para IAs descobrirem as capacidades automaticamente.

---

### POST /read_file
Lê o conteúdo de um arquivo.

**Payload:**
```json
{ "path": "Cerebro/03_Tarefas/kanban.md" }
```
**Resposta:**
```json
{
  "ok": true,
  "path": "Cerebro/03_Tarefas/kanban.md",
  "content": "# Kanban...",
  "size": 4521
}
```

---

### POST /write_file
Cria ou sobrescreve um arquivo (cria diretórios intermediários automaticamente).

**Payload:**
```json
{
  "path": "Cerebro/02_Memoria/novo.md",
  "content": "# Título\nConteudo aqui"
}
```
**Resposta:**
```json
{ "ok": true, "path": "Cerebro/02_Memoria/novo.md", "written": 22 }
```

---

### POST /append_file
Acrescenta conteúdo ao final de um arquivo existente (cria se não existir).

**Payload:**
```json
{
  "path": "Cerebro/04_Diario/2026-05-30.md",
  "content": "\n\n## Nova entrada\nTexto..."
}
```
**Resposta:**
```json
{ "ok": true, "path": "...", "appended": 30, "total_size": 1024 }
```

---

### POST /delete_file
Remove um arquivo individual. **Não remove pastas.**

**Payload:**
```json
{ "path": "Cerebro/lixo.txt" }
```
**Resposta:**
```json
{ "ok": true, "deleted": "Cerebro/lixo.txt" }
```

---

### POST /move_file
Move ou renomeia arquivo ou diretório.

**Payload:**
```json
{
  "source": "Cerebro/rascunho.md",
  "destination": "Cerebro/02_Memoria/final.md"
}
```
**Resposta:**
```json
{ "ok": true, "moved": { "from": "Cerebro/rascunho.md", "to": "Cerebro/02_Memoria/final.md" } }
```

---

### POST /list_dir
Lista conteúdo de um diretório (exclui `.git/`).

**Payload:**
```json
{ "path": "Cerebro/" }
```
**Resposta:**
```json
{
  "ok": true,
  "path": "Cerebro/",
  "entries": [
    { "name": "00_Sistema", "type": "dir", "size": null },
    { "name": "03_Tarefas", "type": "dir", "size": null },
    { "name": "claude.md",  "type": "file", "size": 512 }
  ],
  "count": 3
}
```

---

### POST /run_script
Executa script EXISTENTE no workspace. Aceita `.sh`, `.py`, `.js`, `.mjs`.

**Payload:**
```json
{
  "script_path": "Scripts/bootstrap/03_start_services.sh",
  "args": ["--status"]
}
```
**Resposta:**
```json
{
  "ok": true,
  "exit_code": 0,
  "stdout": "...",
  "stderr": ""
}
```

---

### POST /shell_exec
Executa comando shell arbitrário com sandbox de segurança (blacklist de comandos destrutivos).

**Payload:**
```json
{ "command": "free -h" }
```
**Resposta:**
```json
{
  "ok": true,
  "exit_code": 0,
  "stdout": "              total        used        free\nMem:           3.7Gi...",
  "stderr": ""
}
```

**Comandos bloqueados:** `rm -rf /`, `chmod 777`, `fork bombs`, `mkfs`, `reboot`, `shutdown`, `su/sudo`, `pkill termux`, `curl | bash`, etc.

---

### POST /apply_patch
Aplica patch no formato unificado (`diff -u`) em arquivo existente.

**Payload:**
```json
{
  "path": "Scripts/core/dispatch.js",
  "diff": "--- a/dispatch.js\n+++ b/dispatch.js\n@@ -1,3 +1,3 @@\n-const x = 1;\n+const x = 2;\n"
}
```
**Resposta:**
```json
{ "ok": true, "patched": "Scripts/core/dispatch.js", "stdout": "" }
```

---

## Modelo de Uso pelas IAs Externas

```javascript
// Exemplo: IA externa lendo um arquivo via workspace_agent
const response = await fetch('http://127.0.0.1:3333/read_file', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ path: 'Cerebro/03_Tarefas/kanban.md' })
});
const { ok, content } = await response.json();
```

```bash
# Exemplo via curl (Qwen / scripts)
curl -s -X POST http://127.0.0.1:3333/shell_exec \
  -H 'Content-Type: application/json' \
  -d '{"command": "free -h"}'
```

---

## Limitações e Regras de Uso

| Use para | Não use para |
|---|---|
| Ler arquivos e retornar conteúdo | Raciocínio complexo |
| Executar scripts já existentes | Decisões de arquitetura |
| Aplicar diffs/patches | Escrever algoritmos novos |
| Mover, criar, deletar arquivos | Interpretar erros ambíguos |
| Rodar comandos shell e retornar stdout | Debugging de lógica complexa |

---

## Segurança

- Todos os caminhos são validados e resolvidos dentro do `WORKSPACE_ROOT`.
- Path traversal (`../`) é bloqueado com `SECURITY ALERT`.
- Comandos destrutivos são bloqueados via regex (camada sandbox).
- Auditoria completa em `Logs/workspace_agent.log`.
- Servidor escuta apenas `127.0.0.1` (não exposto na rede local).

---
*Gerado por Claude Sonnet 4.6 via MCP · 2026-05-30*
