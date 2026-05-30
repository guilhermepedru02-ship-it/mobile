# Erros Conhecidos e Soluções

## npm install falha no /storage/emulated/0/
- **Erro:** EPERM, symlink não suportado
- **Solução:** Usar `npm install --no-bin-links`

## Phantom Process Killer mata o Node.js
- **Erro:** Processo do code-server ou MCP server morre sozinho
- **Solução:** Aplicar `adb shell "settings put global max_phantom_processes 2147483647"`

## SSE "stream is not readable"
- **Erro:** Após conectar via MCP, o POST para /messages retorna HTTP 400
- **Solução:** Remover `app.use(express.json())` do mcp_server.js

## Timeout na conexão Wi-Fi entre PC e celular
- **Erro:** Connect Timeout ao acessar IP do celular na porta 3001
- **Solução:** Usar ADB Forward (`adb forward tcp:3001 tcp:3001`) e conectar via `127.0.0.1`
