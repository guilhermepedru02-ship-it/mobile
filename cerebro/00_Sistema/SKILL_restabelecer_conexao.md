---
name: restabelecer-conexao-mcp
description: >
  Instruções críticas de como a IA (Manus, n8n, etc) deve agir caso a conexão com o Workspace Mobile seja perdida. Ensina a remontar a URL de conexão com segurança e burlar limitações de headers.
---

# Skill: Restabelecer Conexão MCP

## O Contexto
Você está conectada a um **Workspace Mobile (Android/Termux)** privado, protegido por uma arquitetura Zero-Trust. O túnel que expõe este servidor para a internet (Serveo/Ngrok) é efêmero. Se o túnel cair ou reiniciar, o domínio (ex: `https://abcd.serveousercontent.com`) vai mudar, e a sua conexão vai falhar com erros `400` ou `401`.

## O Que Fazer Quando a Conexão Cair
Se o usuário lhe fornecer um **novo link HTTP** (dizendo que o túnel reiniciou), você DEVE aplicar esta skill para se reconectar com sucesso:

### 1. A Regra do Transporte (SSE)
Você DEVE configurar a sua ferramenta de conexão MCP para usar o transporte **HTTP / SSE (Server-Sent Events)**. Não tente usar `stdio`.

### 2. A Regra do Token (Query String)
O Gatekeeper exige autenticação via Token. Como a sua interface oficial pode rejeitar a injeção manual de cabeçalhos (`Authorization: Bearer`), você DEVE passar a chave de segurança **diretamente na URL**.

**Fórmula da URL de Conexão:**
`[NOVO_LINK_FORNECIDO]/sse?token=[CHAVE_SECRETA_EXISTENTE]`

- **NOVO_LINK_FORNECIDO:** A base HTTP que o usuário acabou de lhe passar.
- `/sse`: O endpoint obrigatório de eventos.
- `?token=`: O parâmetro de consulta.
- `[CHAVE_SECRETA_EXISTENTE]`: A mesma chave API (API_SECRET_KEY) que você usou na sua primeira conexão bem-sucedida. O usuário NÃO precisa lhe dar a chave de novo, ela não muda. Use a que você tem na memória.

### Exemplo Prático
Se o usuário disser: *"O túnel caiu, o novo link é https://xyz.serveousercontent.com"*
Você imediatamente configura sua conexão para:
`https://xyz.serveousercontent.com/sse?token=sk_edge_...sua_chave_aqui...`

## Erros Comuns (Não repita)
- ❌ **Fechar a Stream SSE antes do POST:** O protocolo MCP exige que a conexão GET `/sse` fique aberta (async/thread) perpetuamente. Se você fechar o túnel GET para fazer o POST, o servidor retornará Erro 400 (Sessão Não Encontrada).
- ❌ **Esquecer o endpoint `/sse`:** Se você tentar conectar na raiz do link, receberá a página de aviso do Serveo.
- ❌ **Tentar OAuth:** O servidor não suporta OAuth. Não inicie fluxos de redirect.
