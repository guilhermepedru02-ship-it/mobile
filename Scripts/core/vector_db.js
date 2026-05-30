import fs from 'fs';
import path from 'path';
import MiniSearch from 'minisearch';

const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';
const CACHE_PATH = path.join(WORKSPACE_ROOT, 'Cerebro', '.vector_cache.json');

const DIRS_TO_INDEX = [
    'Cerebro/00_Sistema',
    'Cerebro/01_Planos',
    'Cerebro/02_Memoria',
    'Cerebro/03_Tarefas',
    'Cerebro/04_Diario',
    'Cerebro/Memoria-RAG',
];

const CHUNK_SIZE = 500;
const CHUNK_OVERLAP = 100;

function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
    const chunks = [];
    let start = 0;
    while (start < text.length) {
        const end = Math.min(start + chunkSize, text.length);
        chunks.push(text.slice(start, end));
        start += chunkSize - overlap;
    }
    return chunks;
}

function collectMarkdownFiles(dirPath) {
    const results = [];
    const absoluteDir = path.resolve(WORKSPACE_ROOT, dirPath);
    if (!fs.existsSync(absoluteDir)) return results;

    const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(absoluteDir, entry.name);
        if (entry.isDirectory()) {
            results.push(...collectMarkdownFiles(path.relative(WORKSPACE_ROOT, fullPath)));
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
            results.push(path.relative(WORKSPACE_ROOT, fullPath));
        }
    }
    return results;
}

export async function indexCerebro() {
    console.log('[RAG] Iniciando indexação MiniSearch do Cérebro...');
    const startTime = Date.now();

    const allFiles = [];
    for (const dir of DIRS_TO_INDEX) {
        allFiles.push(...collectMarkdownFiles(dir));
    }

    let totalChunks = 0;
    const documents = [];

    for (const filePath of allFiles) {
        const absolutePath = path.resolve(WORKSPACE_ROOT, filePath);
        try {
            const content = fs.readFileSync(absolutePath, 'utf8');
            if (content.trim().length < 20) continue;

            const chunks = chunkText(content);
            for (let i = 0; i < chunks.length; i++) {
                documents.push({
                    id: `${filePath}#${i}`,
                    file: filePath,
                    text: chunks[i]
                });
                totalChunks++;
            }
        } catch (err) {
            console.error(`\n[RAG] Erro ao indexar ${filePath}: ${err.message}`);
        }
    }

    const miniSearch = new MiniSearch({
        fields: ['text'], // Indexar apenas o texto
        storeFields: ['file', 'text'], // Retornar esses campos no resultado
        searchOptions: {
            fuzzy: 0.2,
            prefix: true
        }
    });

    miniSearch.addAll(documents);
    fs.writeFileSync(CACHE_PATH, JSON.stringify(miniSearch.toJSON()), 'utf8');

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\n[RAG] Indexação concluída! ${totalChunks} chunks indexados em ${elapsed}s.`);
    
    return {
        totalFiles: allFiles.length,
        totalChunks: totalChunks,
        elapsedSeconds: parseFloat(elapsed),
        cachePath: CACHE_PATH,
    };
}

export async function search(query, topK = 5) {
    if (!fs.existsSync(CACHE_PATH)) {
        return {
            success: false,
            error: 'Índice não encontrado. Execute a indexação primeiro.',
        };
    }

    const indexJson = fs.readFileSync(CACHE_PATH, 'utf8');
    const miniSearch = MiniSearch.loadJSON(indexJson, {
        fields: ['text'],
        storeFields: ['file', 'text']
    });

    const results = miniSearch.search(query, { fuzzy: 0.2, prefix: true });
    
    // Pega os Top K resultados
    const topResults = results.slice(0, topK).map(r => ({
        file: r.file,
        relevance: r.score.toFixed(2) + ' pts',
        excerpt: r.text.substring(0, 300)
    }));

    return { success: true, query: query, results: topResults };
}
