# Arquitetura Dual-Server: Workspace Mobile (v2.2)

Esta nota formaliza a decisão estratégica de operar o Workspace Mobile com dois servidores MCP simultâneos, garantindo escalabilidade e separação de preocupações (Separation of Concerns).

## 1. Servidor Core (Porta 3001)
**Responsabilidade:** Orquestração Geral, Memória e Planejamento.
- **Identidade:** `workspace-executor-mcp`
- **Foco:** Leitura/Escrita de arquivos no Cerebro, Gestão do Kanban e Diários.
- **Segurança:** Gatekeeper Zero-Trust ativo.

## 2. Servidor DevTools (Porta 3002)
**Responsabilidade:** Engenharia de Software e Automação Técnica.
- **Identidade:** `workspace-dev-agent-mcp`
- **Foco:** Operações Git, NPM, Build e execução de scripts Python.
- **Credenciais:** Vinculado à identidade oficial de Guilherme Moreno (`guilhermepedru02@gmail.com`).

## 3. Benefícios da Abordagem
*   **Isolamento de Falhas:** Um erro em um processo de build no servidor 3002 não afeta a capacidade de planejamento do servidor 3001.
*   **Paralelismo:** Permite que diferentes agentes (ex: Manus e Claude Desktop) operem em frentes distintas simultaneamente.
*   **Especialização:** As ferramentas são otimizadas para seus domínios específicos (Documentação vs. Engenharia).

---
*Formalizado por Manus em 29/05/2026.*
