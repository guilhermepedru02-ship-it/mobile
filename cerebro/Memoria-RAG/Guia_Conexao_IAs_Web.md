# Guia Definitivo de Conexão MCP (IAs Externas e Locais)

*Este documento estabelece o protocolo arquitetural final para conexão de agentes no Workspace Mobile, incorporando as duras lições aprendidas sobre bloqueios de CORS, roteamento local vs remoto, e limitações de clientes engessados.*

## 1. O Erro do Passado (O Que NÃO Fazer)

Anteriormente, acreditávamos que qualquer IA da web (como a Manus) conseguiria enviar cabeçalhos HTTP customizados (`Authorization: Bearer`) para transpor nosso Gatekeeper. 
**A realidade:** Ferramentas e configuradores oficiais de IAs (como o *manus-mcp-cli*) são frequentemente inflexíveis, rejeitam campos de configuração desconhecidos (ex: injetar *headers*) e presumem fluxos OAuth padrão. A tentativa de forçar cabeçalhos resultou em erros `4xx` (Unauthorized / Legacy SSE) fatais.

Além disso, ao ativarmos o túnel (Serveo/Ngrok), trancávamos o servidor inteiro de forma burra, o que **derrubava as nossas próprias ferramentas locais via cabo USB** (Claude Desktop e Antigravity), que se conectavam pelo `127.0.0.1:3001` sem senha.

## 2. A Arquitetura Híbrida Atual (Definitiva)

Implementamos um `auth_middleware.js` inteligente que resolve ambos os problemas simultaneamente:

### A. Para IAs da Nuvem (ex: Manus.ia)
A autenticação agora pode ser feita **diretamente na URL** via parâmetro de consulta (*Query String*). Isso burla a limitação de IAs engessadas que não permitem injetar *headers*.

**Configuração Oficial na Manus:**
1. **Tipo:** Servidor SSE
2. **URL:** `https://[seu-link-do-serveo].serveousercontent.com/sse?token=[SUA_CHAVE_SECRETA]`
*(Nota: Não é necessário pedir para a IA enviar cabeçalhos Bearer. Apenas forneça a URL com o `?token=` no final e a conexão será estabelecida de forma nativa e transparente).*

### B. Para Ferramentas Locais via Cabo USB (Claude Desktop / Antigravity)
O servidor agora é capaz de ler o cabeçalho `x-forwarded-for`. 
- **Tráfego Externo:** Túneis (Serveo) sempre injetam o `x-forwarded-for`. O servidor vê isso e exige o Token da URL.
- **Tráfego USB (ADB):** Conexões que vêm pelo cabo USB mapeando o `localhost` **não** possuem `x-forwarded-for`. O servidor identifica isso como tráfego físico seguro e **abre a porta sem exigir senha**. 

**Configuração Oficial no PC Local (Claude/Antigravity):**
1. **Tipo:** Servidor SSE local (via ponte `mcp_stdio_sse_bridge`)
2. **URL:** `http://127.0.0.1:3001/sse`
*(Nota: Nunca adicione token aqui. O cabo de dados já é a sua autenticação física).*

---
> **Regra de Ouro Final:** Não adicione dependências ao `mcp_server.js` (como pacotes CORS de terceiros) a menos que o `npm install` seja completamente validado no Termux primeiro, pois imports faltantes causam falha silenciosa na inicialização do NodeJS.
