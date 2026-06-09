/**
 * vector_db.js — FASE 4: RAG Vetorial Real
 * 
 * Substitui MiniSearch (keyword) por embeddings vetoriais via llama-server.
 * Arquitetura hibrida: vetorial (primario) + MiniSearch (fallback).
 *
 * Versao: 2.0.0 · 2026-05-31
 * Autor: Claude Sonnet 4.6 via sessao MCP
 *
 * Mudancas v2.0.0:
 *   - embeddings reais via POST /v1/embeddings (llama-server --embeddings)
 *   - similaridade cosseno para ranking semantico
 *   - cache vetorial em .vector_cache_v2.json (formato novo, incompativel com v1)
 *   - fallback automatico para MiniSearch se embeddings indisponivel
 *   - indexacao incremental: so re-embeda arquivos modificados
 */

import fs from 'fs';
import path from 'path';
import MiniSearch from 'minisearch';

const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';
const CACHE_V1_PATH  = path.join(WORKSPACE_ROOT, 'Cerebro', '.vector_cache.json');
const CACHE_V2_PATH  = path.join(WORKSPACE_ROOT, 'Cerebro', '.vector_cache_v2.json');
const LLAMA_BASE     = 'http://127.0.0.1:11434';
const EMBED_MODEL    = 'qwen2.5-0.5b-instruct-q4_k_m.gguf';
const EMBED_DIM      = 896; // n_embd do Qwen 0.5B

const DIRS_TO_INDEX = [
    'Cerebro/00_Sistema',
    'Cerebro/01_Planejamento',
    'Cerebro/02_Memoria',
    'Cerebro/03_Tarefas',
    'Cerebro/04_Diario',
    'Cerebro/Memoria-RAG',
];

const CHUNK_SIZE    = 180;
const CHUNK_OVERLAP = 30;

// ============================================================
// UTILITARIOS
// ============================================================

function chunkText(text, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        chunks.push(text.slice(start, Math.min(start + size, text.length)));
        start += size - overlap;
    }
    return chunks;
}

function collectMarkdownFiles(dirPath) {
    const results = [];
    const abs = path.resolve(WORKSPACE_ROOT, dirPath);
    if (!fs.existsSync(abs)) return results;
    for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
        const full = path.join(abs, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectMarkdownFiles(path.relative(WORKSPACE_ROOT, full)));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            results.push(path.relative(WORKSPACE_ROOT, full));
        }
    }
    return results;
}

// Similaridade cosseno entre dois vetores
function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot   += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

// ============================================================
// EMBEDDINGS — chamada ao llama-server
// ============================================================

async function getEmbedding(text) {
    const res = await fetch(`${LLAMA_BASE}/v1/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: EMBED_MODEL, input: text.slice(0, 200) })
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Embeddings HTTP ${res.status}: ${err.slice(0, 100)}`);
    }
    const data = await res.json();
    return data.data?.[0]?.embedding ?? null;
}

async function isEmbeddingsAvailable() {
    try {
        const vec = await getEmbedding('teste');
        return Array.isArray(vec) && vec.length > 0;
    } catch {
        return false;
    }
}

// ============================================================
// INDEXACAO VETORIAL
// ============================================================

export async function indexCerebro() {
    console.log('[RAG v2] Iniciando indexacao do Cerebro...');
    const startTime = Date.now();

    // Verifica se embeddings estao disponiveis
    const useVectors = await isEmbeddingsAvailable();
    console.log(`[RAG v2] Modo: ${useVectors ? 'VETORIAL (embeddings reais)' : 'KEYWORD (MiniSearch fallback)'}`);

    // Coleta todos os arquivos
    const allFiles = [];
    for (const dir of DIRS_TO_INDEX) allFiles.push(...collectMarkdownFiles(dir));

    // Carrega cache existente para indexacao incremental
    let existingCache = { mode: null, chunks: [], mtime_map: {} };
    if (useVectors && fs.existsSync(CACHE_V2_PATH)) {
        try {
            existingCache = JSON.parse(fs.readFileSync(CACHE_V2_PATH, 'utf8'));
        } catch { /* cache corrompido, reindexa tudo */ }
    }

    const mtimeMap    = existingCache.mtime_map ?? {};
    const oldChunks   = existingCache.chunks ?? [];
    const keepChunks  = [];
    const filesToEmbed = [];
    const newMtimeMap = {};

    for (const filePath of allFiles) {
        const abs   = path.resolve(WORKSPACE_ROOT, filePath);
        const mtime = fs.statSync(abs).mtimeMs.toString();
        newMtimeMap[filePath] = mtime;

        if (useVectors && mtimeMap[filePath] === mtime) {
            // Arquivo nao mudou — reutiliza chunks do cache
            keepChunks.push(...oldChunks.filter(c => c.file === filePath));
        } else {
            filesToEmbed.push(filePath);
        }
    }

    console.log(`[RAG v2] ${keepChunks.length} chunks em cache | ${filesToEmbed.length} arquivos para indexar`);

    let newChunks = [];
    let totalChunks = keepChunks.length;

    if (useVectors) {
        // MODO VETORIAL
        for (const filePath of filesToEmbed) {
            const abs = path.resolve(WORKSPACE_ROOT, filePath);
            try {
                const content = fs.readFileSync(abs, 'utf8');
                if (content.trim().length < 20) continue;
                const chunks = chunkText(content);
                for (let i = 0; i < chunks.length; i++) {
                    const vec = await getEmbedding(chunks[i]);
                    if (!vec) continue;
                    newChunks.push({
                        id: `${filePath}#${i}`,
                        file: filePath,
                        text: chunks[i],
                        vector: vec
                    });
                    totalChunks++;
                }
            } catch (err) {
                console.error(`[RAG v2] Erro ao embedar ${filePath}: ${err.message}`);
            }
        }

        const allChunks = [...keepChunks, ...newChunks];
        fs.writeFileSync(CACHE_V2_PATH, JSON.stringify({
            mode: 'vector',
            version: '2.0.0',
            indexed_at: new Date().toISOString(),
            embed_dim: EMBED_DIM,
            mtime_map: newMtimeMap,
            chunks: allChunks
        }), 'utf8');

    } else {
        // MODO KEYWORD (fallback MiniSearch — mesmo comportamento da v1)
        const documents = [];
        for (const filePath of allFiles) {
            const abs = path.resolve(WORKSPACE_ROOT, filePath);
            try {
                const content = fs.readFileSync(abs, 'utf8');
                if (content.trim().length < 20) continue;
                const chunks = chunkText(content);
                for (let i = 0; i < chunks.length; i++) {
                    documents.push({ id: `${filePath}#${i}`, file: filePath, text: chunks[i] });
                    totalChunks++;
                }
            } catch (err) {
                console.error(`[RAG v2] Erro ao indexar ${filePath}: ${err.message}`);
            }
        }
        const ms = new MiniSearch({ fields: ['text'], storeFields: ['file', 'text'], searchOptions: { fuzzy: 0.2, prefix: true } });
        ms.addAll(documents);
        fs.writeFileSync(CACHE_V1_PATH, JSON.stringify(ms.toJSON()), 'utf8');
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[RAG v2] Indexacao concluida! ${totalChunks} chunks em ${elapsed}s | modo: ${useVectors ? 'vetorial' : 'keyword'}`);
    return { totalFiles: allFiles.length, totalChunks, elapsedSeconds: parseFloat(elapsed), mode: useVectors ? 'vector' : 'keyword' };
}

// ============================================================
// BUSCA — vetorial ou keyword
// ============================================================

export async function search(query, topK = 5) {
    // Tenta busca vetorial primeiro
    if (fs.existsSync(CACHE_V2_PATH)) {
        try {
            const cache = JSON.parse(fs.readFileSync(CACHE_V2_PATH, 'utf8'));
            if (cache.mode === 'vector' && cache.chunks?.length > 0) {
                const queryVec = await getEmbedding(query);
                if (queryVec) {
                    const scored = cache.chunks
                        .map(chunk => ({ ...chunk, score: cosineSimilarity(queryVec, chunk.vector) }))
                        .sort((a, b) => b.score - a.score)
                        .slice(0, topK);

                    return {
                        success: true,
                        mode: 'vector',
                        query,
                        results: scored.map(r => ({
                            file: r.file,
                            relevance: (r.score * 100).toFixed(1) + '%',
                            excerpt: r.text.substring(0, 300)
                        }))
                    };
                }
            }
        } catch { /* fallback para keyword */ }
    }

    // Fallback: MiniSearch keyword
    if (!fs.existsSync(CACHE_V1_PATH)) {
        return { success: false, error: 'Nenhum indice encontrado. Execute a indexacao primeiro.' };
    }
    const ms = MiniSearch.loadJSON(fs.readFileSync(CACHE_V1_PATH, 'utf8'), {
        fields: ['text'], storeFields: ['file', 'text']
    });
    const results = ms.search(query, { fuzzy: 0.2, prefix: true }).slice(0, topK);
    return {
        success: true,
        mode: 'keyword',
        query,
        results: results.map(r => ({
            file: r.file,
            relevance: r.score.toFixed(2) + ' pts',
            excerpt: r.text.substring(0, 300)
        }))
    };
}
