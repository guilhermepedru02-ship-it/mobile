# Resumo da Sessão — 2026-05-29 (Arquitetura IA Local Soberana)
**Duração aproximada:** ~12 ações executadas
**Projeto:** Arquitetura da IA Local Offline (Ollama + MCP)

## O que foi feito
- Leitura do diário de 2026-05-29: Guilherme descreveu visão de uma IA própria offline soberana, sem dependência de API keys, compensando limitações de modelos pequenos com arquitetura de governança de dados, catálogo de ferramentas e memória persistente de execução.
- Análise completa da proposta: validada a abordagem Tool-Augmented Agent com RAG Soberano.
- Criado documento de arquitetura completo em `01_Planejamento/Arquitetura_IA_Local_Soberana.md`.
- Kanban refatorado com milestones 0 a 4.

## Decisões Tomadas
- Arquitetura central: **Dispatch → RAG → Tool Registry → Context Builder → Ollama → MCP Executor**
- IA local opera em porta 4001 (separada da API REST existente na 4000)
- MCP + Túnel Serveo permanecem como fallback permanente
- Working Memory salva em `02_Memoria/working_memory_active.json` durante execuções longas

> ⚠️ **CORREÇÃO (registrada após Milestone 1):** A recomendação original de `llama3.2:3b` como modelo inicial foi revisada após diagnóstico real de hardware. O dispositivo possui **3.7GB de RAM física** (os "12GB" anunciados incluem RAM estendida/swap). O modelo inicial correto é `llama3.2:1b`. O `3b` será testado após o Milestone 2 estar estável. Consultar `2026-05-29_milestone1_ollama_validado.md` para detalhes completos.

## Palavras-chave
#ollama #ia-local #soberana #offline #tool-augmented-agent #rag #working-memory #dispatch #context-builder #arquitetura #milestone
