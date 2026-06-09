/**
 * test_embeddings.mjs — Teste da FASE 4: RAG Vetorial
 * Executa: node test_embeddings.mjs
 */

import { indexCerebro, search } from './vector_db_v2.js';

console.log('=== FASE 4 — Teste RAG Vetorial ===\n');

// 1. Testa se embeddings estao disponiveis
console.log('1. Verificando endpoint /v1/embeddings...');
try {
    const res = await fetch('http://127.0.0.1:11434/v1/embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'qwen2.5-0.5b-instruct-q4_k_m.gguf', input: 'teste' })
    });
    const data = await res.json();
    if (data.error) {
        console.log(`   [FALHOU] ${data.error.message}`);
        console.log('   -> Reinicie o llama-server com --embeddings e tente novamente.');
        process.exit(1);
    }
    const dim = data.data?.[0]?.embedding?.length;
    console.log(`   [OK] Embeddings disponiveis! Dimensao: ${dim}`);
} catch (err) {
    console.log(`   [ERRO] ${err.message}`);
    process.exit(1);
}

// 2. Indexa o Cerebro
console.log('\n2. Indexando o Cerebro (modo vetorial)...');
const indexResult = await indexCerebro();
console.log(`   [OK] ${indexResult.totalChunks} chunks | ${indexResult.elapsedSeconds}s | modo: ${indexResult.mode}`);

// 3. Testa busca semantica
console.log('\n3. Testando busca semantica...');
const queries = [
    'soberania de dados',
    'embeddings vetoriais RAG',
    'arquitetura do enxame cloud bridge'
];

for (const q of queries) {
    const result = await search(q, 3);
    console.log(`\n   Query: "${q}" [${result.mode}]`);
    if (result.success && result.results.length > 0) {
        result.results.forEach((r, i) => {
            console.log(`   ${i+1}. [${r.relevance}] ${r.file}`);
            console.log(`      ${r.excerpt.slice(0, 100).replace(/\n/g, ' ')}...`);
        });
    } else {
        console.log('   Nenhum resultado encontrado.');
    }
}

console.log('\n=== Teste concluido com sucesso! FASE 4 operacional. ===');
