# Relatório: Conexão MCP entre Claude Desktop e Sistema Android

**Data:** 28/05/2026  
**Autor:** Guilherme Moreno  
# **Status atual:** Concluída 😁 

---

## 1. Objetivo

Estabelecer uma conexão MCP (Model Context Protocol) entre o **Claude Desktop (Windows)** e um servidor MCP rodando nativamente no **Android via Termux**, permitindo que a IA execute ações diretamente no dispositivo móvel — criação de arquivos, execução de comandos shell e interação com o Workspace local em `/storage/emulated/0/Workspace`.

---

## 2. Arquitetura da Solução

```
Claude Desktop (Windows)
        ↓ stdio
mcp_stdio_sse_bridge.js (PC)
        ↓ HTTP/SSE
ADB Port Forward (USB)
        ↓ tcp:3001 → tcp:3001
mcp_server.js (Termux/Android)
        ↓
executor.js → Workspace Android
```

---

## 3. Componentes 

### `mcp_server.js` (Android/Termux)
Servidor MCP em Node.js rodando no Termux. Expõe a ferramenta `execute_workspace_action`, que recebe um array de `actions` e as executa de forma síncrona via `executor.js`. Utiliza `express` com transporte SSE do SDK oficial do MCP.

### `mcp_stdio_sse_bridge.js` (PC/Windows) criado no Antigravity
Ponte customizada que traduz o protocolo Stdio (esperado pelo Claude Desktop) para SSE (utilizado pelo servidor no celular). Substitui o pacote `mcp-sse-bridge` do npm, que apresentou bug crítico de porta fixa.

### `mcp_client_test.js` (PC) Criado no Antigravity 
Script de teste para validar a conexão e executar ações no celular de forma isolada, sem depender do Claude Desktop.

---

## 4. Problemas Encontrados e Resoluções

### Problema 1 — `mcp-sse-bridge` criado no Claude, ignorava o argumento de URL 
**Sintoma:** Erro `ECONNREFUSED 127.0.0.1:8082`. O pacote npm `mcp-sse-bridge` ignorava o argumento `http://127.0.0.1:3001/sse` passado no `claude_desktop_config.json` e tentava sempre conectar na porta padrão `8082`.  
**Resolução:** Substituído pelo `mcp_stdio_sse_bridge.js` do Antigravity customizado, que conecta diretamente na porta correta.
> (Mas a porta adb forward tcp:8082 tcp:3001 ainda continua aberta via adb) Fizemos essa abertura via adb para tentar a conexão mesmo na porta 8082, mas a conexão caia na hora.

### Problema 2 — ADB Port Forward não configurado corretamente
**Sintoma:** Conexão recusada mesmo com o servidor rodando no celular.  

**Resolução:** Configurar o redirecionamento de porta via ADB antes de abrir o Claude Desktop normalizando a conexão adb na porta correta:
```bash
adb forward tcp:3001 tcp:3001
```

### Problema 3 — Servidor SSE derrubava a conexão ao ser testado pelo navegador
**Sintoma:** Ao acessar `http://127.0.0.1:3001/sse` pelo navegador para testar, o app no celular fechava. Isso ocorre porque o servidor aceitava apenas uma conexão simultânea — o navegador ocupava a única vaga disponível.  
**Resolução:** Usar o endpoint `/health` para testes em vez do `/sse`:
```
http://127.0.0.1:3001/health
```

### Problema 4 — `other side closed` (em resolução)
**Sintoma:** Erro `SSE error: TypeError: fetch failed: other side closed`. O ADB chegava corretamente no celular, mas o servidor encerrava a conexão imediatamente.  
**Causa raiz identificada:** O objeto `Server` do SDK MCP é uma instância singleton por processo — ao tentar uma segunda conexão (ou reconexão do Claude), lançava a exceção:
```
Already connected to a transport. Call close() before connecting 
to a new transport, or use a separate Protocol instance per connection.
```
**Solução:** Mover a instanciação do `Server` para dentro do handler do endpoint `/sse`, criando uma nova instância a cada conexão:
```js
app.get("/sse", async (req, res) => {
  const server = new Server(...); // nova instância por conexão
  server.setRequestHandler(...);
  const transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});
```

---

## 5. Configuração Final

### `claude_desktop_config.json` (Windows)
```json
{
  "mcpServers": {
    "workspace-telemovel": {
      "command": "node",
      "args": ["C:\\Users\\Guilherme Moreno\\.claude\\mcp_stdio_sse_bridge.js"]
    }
  }
}
```

### Ordem de inicialização obrigatória
1. Iniciar o servidor no Termux: `node mcp_server.js`
2. Ativar o port forward ADB no PC: `adb forward tcp:3001 tcp:3001`
3. Abrir o Claude Desktop
> O  `claude_desktop_config.json` já está configurado corretamente, mas o usuário prefere passar a análise para o Antigravity, após a IA analisar a mudança proposta veremos se a mudança do mcp_server será abraçada para ai então fazer a conexão com o Claude desktop. 
> Para o Usuário o comportamento de conexão via MCP do Claude está muito estranho, pois a grande questão que fica é "se para o Antigravity a instalação desse MCP modo nativo foi tão simples e quase que intuitiva, porque o Claude Desktop esbarrou em tantos erros e necessita de tantos ajustes, principalmente de ajuste no MCP?"

---

## 6. Próximo Passo

Aplicar a correção do **Problema 4** no `mcp_server.js` do Termux — mover a criação do `Server` para dentro do endpoint `/sse` — e validar a conexão completa com o 🔨 aparecendo no Claude Desktop.

---

## 7. Ferramenta Exposta

| Nome | Descrição |
|---|---|
| `execute_workspace_action` | Executa comandos ou cria arquivos no Workspace Mobile via array de `actions` |

**Tipos de action suportados:** `run_command`, `create_file`, `read_file`, `append_file`, `list_dir`  
**Caminho base:** `/storage/emulated/0/Workspace`  
**Segurança:** Proteção contra Path Traversal e comandos de alto risco ativos no `executor.js`

#pendentedemaximaimportancia #mcp #concluido 
