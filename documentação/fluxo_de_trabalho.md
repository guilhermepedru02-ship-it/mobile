# 🧭 O Fluxo de Trabalho Completo: Quem Faz O Quê

Seu raciocínio está quase certo, mas com uma distinção crucial. Vou definir o papel de cada pasta:

| Pasta | Quem Escreve | Propósito |
| :--- | :--- | :--- |
| **00_Sistema** | VOCÊ (e raramente a IA) | A "Constituição". Você define as regras. A IA apenas lê. |
| **01_Planejamento** | A IA (por ordem sua) | Antes de codar qualquer projeto, a IA cria um plano aqui para você aprovar. |
| **02_Memoria** | A IA (automaticamente) | A IA deposita aqui tudo que "aprendeu": decisões técnicas, preferências suas, erros passados. |
| **03_Tarefas** | AMBOS | Você pode adicionar tarefas manualmente no kanban, e a IA atualiza o status conforme executa. |
| **04_Diario** | VOCÊ (manualmente) | Seu espaço pessoal. Você escreve livremente sobre ideias, arquiteturas, planos, reflexões. |
| **Memoria-RAG** | A IA (automaticamente) | Fragmentos de contexto que a IA extrai dos seus diários e projetos para "lembrar" entre sessões. |

## 📘 Como Funciona na Prática (O Seu Dia-a-Dia)

1. **Ideia no Diário:** Você tem uma ideia para um app. Abre o Obsidian no celular e escreve em `04_Diario/2026-05-28.md`:
   > "Quero fazer um app de controle de gastos em React Native. Precisa ter login, dashboard com gráficos e sincronização offline."
2. **Comando Inicial:** Você conecta o celular no PC, abre a IDE e diz para a IA:
   > "Leia meu diário de hoje e comece a trabalhar no projeto que descrevi."
3. **Execução do Protocolo:** A IA, seguindo o protocolo do Gatekeeper, vai:
   * Ler `00_Sistema/README.md` → Destravar sessão.
   * Ler `04_Diario/2026-05-28.md` → Absorver seu pedido.
   * Ler `02_Memoria/preferencias_usuario.md` → Lembrar que você gosta de documentação antes de código.
   * Ler `02_Memoria/decisoes_tecnicas.md` → Lembrar das decisões anteriores.
   * Criar um plano detalhado em `01_Planejamento/app_gastos.md` → Para sua aprovação.
   * Atualizar o Kanban em `03_Tarefas/kanban.md` com as novas tarefas.
4. **Desenvolvimento Continuado:** Você aprova o plano no Obsidian. Na próxima sessão:
   * A IA começa a codar em `Apps/` ou `Projetos/`.
   * Conforme resolve bugs ou toma decisões, ela salva em `02_Memoria/decisoes_tecnicas.md`.
   * Fragmentos relevantes vão para `Memoria-RAG/` para persistir entre sessões.

## 🧠 Sobre a Memória-RAG

A pasta `Memoria-RAG` é a mais poderosa de todas. Ela deveria funcionar assim: toda vez que a IA terminar uma sessão de trabalho, ela extrai pedaços-chave do que aconteceu (erros resolvidos, preferências descobertas, padrões de código usados) e salva como fragmentos curtos ali dentro. Na próxima sessão, antes de agir, ela lê esses fragmentos para "lembrar" do que aconteceu ontem. 

Hoje ela está vazia (só tem um `.keep`). Precisamos definir e implementar esse comportamento no `system_prompt.md` para que a IA comece a populá-la de forma autônoma.

---

**Quer que eu formalize todo esse fluxo criando/atualizando o `system_prompt.md` no seu celular para que qualquer IA futura que se conectar ao seu Workspace siga exatamente esse protocolo operacional?**
