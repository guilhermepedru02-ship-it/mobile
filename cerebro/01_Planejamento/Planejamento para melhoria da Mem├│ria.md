
1. Chunking semântico na Memoria-RAG — fácil, alto impacto. Hoje os fragmentos são cortados por tamanho (150 chars). Podemos cortar por seções markdown (##) para preservar o significado. Mudança de 5 linhas no context_builder.js.
2. Embeddings vetoriais — o llama-server já tem o endpoint /v1/embeddings nativo, sem nenhum serviço extra. Você usaria o mesmo Qwen 0.5B como modelo de embedding. A qualidade é modesta (modelo pequeno), mas suficiente para busca semântica no seu Cerebro. O custo real é o tempo de indexação inicial e ~50MB de armazenamento para os vetores.
3. Hierarquia de memória — a mais poderosa das três. Hoje já existe working_memory.js (curto prazo) e Memoria-RAG (médio prazo), mas não há distinção clara. A estrutura natural seria:
Curto prazo  → working_memory_active.json  (sessão atual, apagada ao finalizar)
Médio prazo  → Memoria-RAG/               (fragmentos por sessão, lidos via RAG)
Longo prazo  → Cerebro/02_Memoria/        (decisões técnicas, preferências, erros)
              + Cerebro/05_Conhecimento/  (pasta nova: documentação permanente)
A IA local já leria a hierarquia de forma inteligente: working memory sempre, RAG dos últimos 7 dias, longo prazo só quando relevante por palavra-chave.
#pendente 