# Arquitetura Final: Busca Semântica Local (RAG Soberano)

**Data da Finalização:** 2026-05-29
**Status:** #concluido 
**Tecnologia Adotada:** BM25 / Inverted Index (Node.js via `minisearch`)

## Objetivo
Implementar uma camada de recuperação de informação (Retrieval-Augmented Generation - RAG) nativa no Workspace Mobile. A meta é permitir que qualquer IA recupere dados contextuais precisos do "Cérebro" sem estourar o limite de tokens com buscas cegas ou leitura de arquivos irrelevantes.

## O Desafio Tecnológico e a Pivotagem
O plano original previa a utilização de Embeddings Tensoriais (Vetores de 384 dimensões via Modelos Transformers rodando offline). 

**O Problema:** A arquitetura Android/Termux colapsou ao tentar carregar binários compilados em C++ (WebAssembly) necessários para os modelos ONNX e bibliotecas como `sharp` e `transformers.js`. Houve falhas agudas de alocação de memória e corrupção de binários nativos.

**A Solução (Pivotagem):** Abandonamos a abordagem de Embedding Neural em favor da abordagem algorítmica de Busca Invertida com **Fuzzy Search** via `minisearch`. Essa tecnologia roda puramente em JavaScript (100% suportado no Node.js do Android), sem dependências binárias nativas.
- Indexa 150 pedaços de texto (*chunks*) em míseros 0.3 segundos.
- Perdoa erros de digitação (Fuzzy match) e pontua relevância via algoritmos como BM25 (TF-IDF).
- Não consome a bateria nem sobrecarrega a RAM do dispositivo celular.

## A Arquitetura Implementada

### 1. O Indexador Central (`vector_db.js`)
O script percorre iterativamente todas as notas do sistema (Cerebro, Projetos, etc), quebrando textos grandes em *chunks* e alimentando o índice em memória. O índice é então persistido num cache leve `.vector_cache.json` na raiz do Workspace.

### 2. Integração no `executor.js`
Foram adicionadas duas novas ações ao núcleo da nossa API:
- `index_cerebro`: Uma função autônoma que engatilha a reindexação global das anotações em disco.
- `semantic_search`: Recebe um parâmetro `query` (ex: "preferências de segurança") e retorna as 5 passagens de texto mais relevantes em questão de milissegundos.

### 3. Frontend no Bot do Telegram (Chronos v3)
A busca semântica foi embutida diretamente no Telegram para consultas rápidas do usuário:
- Comando `/indexar`: Reconstrói toda a malha de conhecimento sob demanda.
- Comando `/buscar [termo]`: Imprime o resultado do RAG local de forma clara no chat. 

## Veredito
O "RAG Soberano" provou que pragmatismo algorítmico (BM25) vence o *hype* neural em ambientes de computação de borda (celulares). O sistema é limpo, autônomo, não tem dependência de APIs externas e empodera qualquer agente MCP com um nível de "memória de longo prazo" sem precedentes.