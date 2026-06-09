# Arquitetura Futura: Autoevolução Autônoma do Agente Local

**Data de Registro:** 2026-06-08 03:24
**Objetivo:** Permitir que a IA local (Qwen) e seu Fallback em Nuvem (NVIDIA NIM / Llama 8B) realizem alterações reais no código, executem scripts e testem funcionalidades de forma autônoma via Telegram ou Interface Nativa, sem depender de sessões externas via MCP.

---

## 🏗️ 1. O Desafio Atual
Atualmente, a ponte cloud (`cloud_bridge.js`) e o agente local (`ollama_agent.js`) operam como um **Assistente Consultivo**. O LLM pode gerar código perfeito, mas não possui as vias neurológicas (permissões e loop de execução) para instanciar esse código no sistema de arquivos do Android ou testá-lo no terminal. 

## 🛣️ 2. Passos Arquiteturais para Implementação

Para elevar o sistema ao nível de **Engenheiro Autônomo**, será necessário construir o "Loop Agêntico" usando os componentes que já existem (Workspace Agent 3333):

### Passo A: Habilitar Function Calling no Fallback (NVIDIA)
1. Atualizar o `cloud_bridge.js` para suportar o parâmetro `tools` na API OpenAI-compatible da NVIDIA.
2. Fornecer ao modelo Llama 3.1 8B descrições claras de ferramentas como `escrever_arquivo`, `ler_arquivo` e `rodar_comando`.

### Passo B: Ponte de Ação via Agent 3333
O `workspace_agent_server.js` (porta 3333) já possui a capacidade física de manipular arquivos e rodar processos no Termux.
1. O agente local (porta 4001) precisará atuar como um orquestrador. Se a nuvem pedir para executar a ferramenta `escrever_arquivo`, o 4001 faz a chamada REST para o `3333` e devolve a resposta (sucesso/erro) para a nuvem.

### Passo C: Human-in-the-Loop (Segurança no Telegram)
Para evitar que uma alucinação apague o disco ou destrua componentes cruciais:
1. Quando a IA decidir rodar um comando (ex: `rm -rf` ou `npm install`), o bot do Telegram interceptará a ação.
2. O bot enviará uma mensagem com botões Inline: `[ ✅ Executar ]` `[ ❌ Cancelar ]`.
3. Somente após o Guilherme apertar "Executar", a ação desce para a porta 3333.

### Passo D: O Loop de Auto-Correção
Se a IA escrever um script e tentar rodá-lo através do Telegram, o `stdout` e o `stderr` do comando devem voltar para o chat. Se houver erro de sintaxe, o LLM deve receber o log de erro e tentar gerar um patch de correção automaticamente.

---

## 🔒 3. Considerações do Gatekeeper
- **Sandbox Restrita:** A IA jamais deverá ter permissão para alterar arquivos essenciais de segurança do Cérebro ou suas próprias chaves `.env`. O `workspace_agent_server.js` deverá ganhar uma "Blacklist" de caminhos proibidos.
- **Isolamento de Estado:** Funcionalidades novas criadas pela IA deverão primeiro ser salvas na pasta `Scripts/archive/experiment/` antes de irem para o `Scripts/core/`.

> **Veredito:** A infraestrutura para isso já existe no projeto atual. A implementação será primariamente uma atualização nos parsers do `bot.js` e do `ollama_agent.js` para suportar *Tool Use* contínuo.
