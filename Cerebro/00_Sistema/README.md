# 00_Sistema — Diretivas Operacionais da IA

Esta pasta contém as **regras fundamentais** que qualquer IA conectada ao Workspace deve ler antes de agir.

## Arquivos Obrigatórios (Leia na Ordem)
1. `system_prompt.md` — O protocolo operacional completo: identidade (llama-server + Qwen 2.5), estrutura de pastas, fluxo de inicialização e encerramento.
2. `ferramentas_disponiveis.md` — Catálogo das ações que o executor aceita, incluindo DevTools (Git, NPM, Python).
3. `seguranca.md` — As 6 camadas de segurança invioláveis (Gatekeeper, Sandbox, Blacklist, etc.).
4. `SKILL_restabelecer_conexao.md` — Instruções cruciais de contingência de rede para remontar o túnel SSE.

## Stack Técnica Atual (03/06/2026)
- **IA Local:** llama-server (OpenAI-compat) na porta 11434.
- **Modelo:** Qwen 2.5 0.5B Q4_K_M.
- **Cloud Fallback:** Gemini 2.0 Flash via GEMINI_API_KEY (Google AI Studio — plano gratuito, quota limitada).
- **Android Bridge:** porta 4444 — acesso zero-trust ao hardware Android.
- **Hub PWA:** porta 5555 — painel de controle mobile (app.js v1.0.3).
- **Status:** Sincronizado com repositório remoto GitHub. Stack 7/7 serviços operacionais.

> **Regra de Ouro:** A IA DEVE ler TODOS os arquivos desta pasta no início de CADA sessão antes de executar qualquer ação. Após ler, siga o Fluxo de Trabalho Padrão descrito no `system_prompt.md`.
