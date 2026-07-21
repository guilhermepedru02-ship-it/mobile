# Ferramentas Disponíveis no Chronos Local

> **Nota de Governança:** Este documento é um reflexo do `Scripts/core/tool_registry.json` (v2.7.2). Qualquer IA externa ou local que precisar entender as capacidades do sistema deve referenciar estas ferramentas.

## Ferramentas do Agente Local (Qwen 0.5B)
| ID da Ferramenta | Descrição |
|---|---|
| `identity_check` | Apresenta a identidade completa do Chronos Local: nome, hardware, modelo, saúde atual, autonomia e missão. |
| `consult_expert_ia` | Delega uma tarefa ou pergunta complexa para uma IA externa (via Cloud Bridge). |
| `cloud_usage` | Verifica o uso de chamadas cloud hoje e o limite diário configurado. |
| `self_health_check` | Auto-diagnóstico completo: RAM, CPU, uptime, status do llama-server e do agente. |
| `tech_news` | Busca as últimas notícias de tecnologia em PT/BR via RSS. |
| `kanban_read` | Lê o Kanban de tarefas atual do Workspace. |
| `list_cerebro` | Lista a estrutura completa do Cérebro (arquivos .md) com tamanhos e status dos caches vetoriais. |
| `git_status` | Mostra o status atual do repositório Git local. |
| `git_log` | Exibe os últimos 10 commits do repositório local. |
| `disk_usage` | Verifica o uso de armazenamento do dispositivo. |
| `ram_status` | Verifica o uso atual de RAM e Swap do dispositivo. |
| `llm_status` | Verifica se o llama-server está rodando e mostra o modelo ativo. |
| `list_tools` | Lista todas as ferramentas disponíveis para o agente local (este mesmo catálogo). |
| `diary_today` | Lê a nota do diário do dia atual. |
| `services_health` | Verifica a saúde de todos os serviços do Workspace (portas ativas, processos). |
| `memory_write` | Registra um aprendizado ou decisão na Memória-RAG. |
| `workspace_agent_status` | Verifica se o workspace_agent_server (porta 3333) está rodando. |

## Busca Vetorial (IAs Externas via MCP `workspace-executor`)
Além das ferramentas base (read_file, write_file, shell_exec, etc.), há as operações nativas:
- `index_cerebro`: Engatilha a reindexação global das anotações em disco (RAG vetorial e BM25).
- `semantic_search`: Recebe `query` e busca passagens de texto relevantes no cache vetorial.