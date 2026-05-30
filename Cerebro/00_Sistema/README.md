# 00_Sistema — Diretivas Operacionais da IA

Esta pasta contém as **regras fundamentais** que qualquer IA conectada ao Workspace deve ler antes de agir.

## Arquivos Obrigatórios (Leia na Ordem)
1. `system_prompt.md` — O protocolo operacional completo: identidade, estrutura de pastas, fluxo de inicialização e encerramento.
2. `ferramentas_disponiveis.md` — Catálogo das 9 ações que o executor.js aceita, com exemplos JSON.
3. `seguranca.md` — As 6 camadas de segurança invioláveis (Gatekeeper, Sandbox, Blacklist, etc.).
4. `SKILL_restabelecer_conexao.md` — Instruções cruciais de contingência de rede. **Leia atentamente** para saber como remontar a conexão caso o túnel caia durante a sua sessão, garantindo que você não perca o acesso.
5.  ![[00_Sistema/preferencias_usuario]]  - 

> **Regra de Ouro:** A IA DEVE ler TODOS os arquivos desta pasta no início de CADA sessão antes de executar qualquer ação. Após ler, siga o Fluxo de Trabalho Padrão descrito no `system_prompt.md`.