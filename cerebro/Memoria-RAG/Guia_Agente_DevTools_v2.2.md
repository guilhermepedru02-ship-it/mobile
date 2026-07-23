# Guia RAG: Agente DevTools Avançado (Workspace Mobile)

Este documento serve como referência de contexto para IAs que operam no Workspace Mobile sobre as capacidades de engenharia disponíveis a partir da versão 2.2.

## 🚀 Capacidades de Engenharia

O sistema agora é capaz de realizar o ciclo completo de desenvolvimento de software (SDLC) de forma autônoma:

### 1. Gestão de Código (Git)
O agente pode interagir com repositórios locais e remotos:
- **Status & Log:** Visualizar o estado atual e histórico.
- **Commit:** Persistir mudanças de forma estruturada.
- **Sync:** Realizar `push` e `pull` para manter o Workspace atualizado.

### 2. Gestão de Dependências e Build (NPM)
Integração nativa com o ecossistema Node.js:
- **Instalação:** `npm install` para novos pacotes.
- **Testes:** Execução de suítes de teste para validar mudanças.
- **Scripts:** Rodar comandos definidos no `package.json`.

### 3. Automação Técnica (Python)
Capacidade de estender o sistema com scripts Python3:
- Processamento massivo de dados.
- Integrações complexas via APIs.
- Automações de sistema que exigem bibliotecas específicas.

## 🛡️ Protocolo de Segurança DevTools
Todas as ações de engenharia passam por um filtro de segurança:
- **Whitelist:** Apenas comandos homologados são permitidos.
- **Isolamento:** Operações restritas à raiz do Workspace.
- **Auditoria:** Registro em tempo real no `executor-audit.log`.

## 💡 Dica para IAs
Sempre use `devtools_action` com o parâmetro `type` correto para garantir que o comando seja processado pelo motor de execução de alta performance.
