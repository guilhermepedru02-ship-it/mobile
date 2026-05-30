# Documentação de Implementação: Workspace Operacional Cognitivo Local (Edge AI)

## Visão Geral
Este documento descreve o planejamento, a arquitetura e a execução técnica da implementação de um "Edge AI Agent Workspace" nativo em dispositivo Android. O objetivo foi permitir que Inteligências Artificiais e ferramentas de desenvolvimento (Antigravity, Cursor, Claude, etc.) conectem-se e modelem softwares diretamente no celular, com autonomia de I/O de disco e execução de shell de maneira segura, gerenciando projetos e interligando anotações com o Obsidian.

---

## 1. Topologia "Filesystem-Native"
A base da operação roda sobre uma única raiz controlada no Android: `/storage/emulated/0/Workspace`.

### Estrutura de Diretórios Criada
- `Apps/` – Repositórios de código para aplicativos Android ou Web.
- `Cerebro/` – Cofre primário do Obsidian. Armazena documentação do projeto, contexto, RAG e notas operacionais.
- `Logs/` – Repositório central de stdout/stderr para auditoria e debbuging do ambiente.
- `Projetos/` – Área de sandbox para pequenos scripts (Python, testes, provas de conceito).
- `Scripts/` – O "motor" operacional (Scripts de instalação, ferramentas base, e a infraestrutura do MCP).

---

## 2. Inicialização do Ambiente Android (Termux)
A infraestrutura roda acima de um contêiner Termux adaptado. O setup instalou todo o ecossistema necessário para uma IDE headless:
- Ferramentas fundamentais: `nodejs`, `python`, `git`, `clang`, `make`, `binutils`, `tmux`, `vim`, `wget`, `curl`.
- Instalação via repositórios `tur-repo` de componentes de terceiros, como a IDE base (VS Code / code-server).
- A IDE Code-Server roda na porta `8080`, provendo ao usuário uma interface visual no navegador para supervisionar os arquivos do Workspace em tempo real enquanto a IA trabalha em background.

---

## 3. Modificações de Kernel (Phantom Process Killer)
O sistema operacional Android (versões 12 e 13+) destrói processos pesados que rodam em background para economizar bateria ("OOM Killer / Phantom Process Killer").
Para o Node.js e o code-server operarem 24/7, foi aplicada uma vacina via ponte ADB a partir do Desktop:
```bash
adb shell "settings put global max_phantom_processes 2147483647"
```
Este comando, aliado à retirada do aplicativo Termux da "Otimização de Bateria" nas configurações do Android, garantiu estabilidade de servidor.

---

## 4. O Coração do Agente: Executor.js
Desenvolvido em Node.js (`Scripts/core/executor.js`), atua como a mão direita da IA.
- Recebe comandos formatados em JSON e executa ações de arquivos e shell.
- **Novas Operações Adicionadas (V1.1):**
  - `delete_file`: Remove arquivo individual com checagem de segurança (não permite deletar pastas recursivamente para evitar desastres).
  - `move_file`: Move/renomeia arquivos e pastas dentro do Workspace.
  - `file_info`: Extrai metadados do arquivo (tamanho, mtime, atime, ctime, tipo).
  - `search_files`: Busca textual recursiva de strings nos arquivos do Workspace.
- **Mecanismo de Segurança Avançado (Blacklist Expandida):** Proteção rígida contra Path Traversal e filtragem estendida via regex para comandos nocivos no shell:
  - Regex contra deleção de raiz (`rm -rf /`), permissões frouxas (`chmod 777`), fork bombs.
  - Bloqueio de gravações raw (`dd`), formatações (`mkfs`), resets (`reboot`/`shutdown`), escalação de privilégios (`su`/`sudo`), kills do Termux (`pkill`), escrita em dispositivos (`/dev/sd`) e downloads inseguros (`curl | bash`).

---

## 5. Ponte Neural: MCP Server (mcp_server.js) e Registro Nativo
A IA se comunica com o `executor.js` de forma nativa e integrada.
- **Servidor MCP:** Desenvolvido localmente em `Scripts/core/mcp_server.js` utilizando o SDK oficial `@modelcontextprotocol/sdk`.
- **Registro Nativo (IDE):** O servidor foi registrado no diretório de MCPs locais da IDE (`C:\Users\Guilherme Moreno\.gemini\antigravity-ide\mcp\workspace-executor`) com seu schema `execute_workspace_action.json` e instruções, permitindo uso direto por ferramentas integradas como `call_mcp_tool`.
- **Protocolo de Transporte:** Server-Sent Events (SSE) na porta `3001` via servidor `express`.
- **Observabilidade & Métricas (V1.1):**
  - Endpoint HTTP `/health` integrado expondo status, uptimeSeconds e métricas operacionais (`totalActionsExecuted`, `successfulActions`, `failedActions`).
  
**Troubleshooting Crucial (Documentado):** O middleware `app.use(express.json())` inicialmente quebrou as requisições de stream raw nativas do protocolo MCP. A remoção do processador de corpo JSON do express permitiu ao SDK do MCP consumir livremente o pipe HTTP, regularizando as conexões.

---

## 6. Túnel de Transmissão por ADB Forward
Devido à restrição de AP Isolation (isolamento de cliente do roteador) que redes Wi-Fi residenciais utilizam, as conexões da IA via rede local resultavam em "Timeouts".
A infraestrutura foi redesenhada para fluir em um protocolo fechado via cabo USB:
```bash
adb forward tcp:3001 tcp:3001
```
Esse redirecionamento garante latência de sub-milissegundos e imunidade a oscilações de roteadores: os requirimentos SSE saem de `127.0.0.1:3001` no computador local diretamente para a porta 3001 interna do Termux.

## 7. Governança, Bootloader e MCP Gatekeeper (Zero Trust)
A infraestrutura foi aprimorada para garantir que qualquer IA conectada ao Workspace opere sob rígidas restrições de governança e não fuja do escopo de segurança, independentemente do seu "System Prompt" padrão de fábrica.

- **Arquivos Bootloader (Nível IDE):** Foram injetados arquivos de instrução ocultos na raiz do Workspace (`.cursorrules`, `.antigravity_instructions`, `.clinerules`, `claude.md`). Qualquer IA moderna ao acessar o repositório absorve essas instruções no seu tempo de inicialização, obrigando-a a ler o documento mestre de regras (`Cerebro/00_Sistema/README.md`) antes de dizer um simples "Olá".
- **MCP Gatekeeper (Nível Backend):** O arquivo `executor.js` foi reforçado com um *State-Lock*. A primeira instrução executada no servidor MCP é ativamente avaliada.
  - Qualquer tentativa de criar arquivos ou rodar comandos é ativamente **bloqueada** até que o executor registre um `read_file` no arquivo de diretivas do Cérebro. 
  - **Timeout de Inatividade:** O estado de sessão possui um temporizador de 30 minutos de ociosidade. Após esse tempo, o ambiente é trancado novamente, obrigando IAs futuras a recarregarem o contexto de segurança.

---

## Conclusão de Implementação e Uso Diário
A infraestrutura foi testada e aprovada, com a IA Antigravity criando com sucesso notas Markdown autônomas no cofre do Obsidian Android.

**Procedimento de Lançamento (Bootstrap Diário):**
1. Plugar o Android via cabo USB.
2. No PC: Rodar `adb forward tcp:3001 tcp:3001`.
3. No celular (Termux): `cd /storage/emulated/0/Workspace/Scripts/core` e `npm start`.
4. A IA (cliente) agora acessa livremente a Tool MCP através de `http://127.0.0.1:3001/sse`.
