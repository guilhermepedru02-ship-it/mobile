#!/usr/bin/env node
/**
 * consolidate_rag.js — Consolidador diário da Memoria-RAG
 * 
 * O que faz:
 *   1. Lê todos os *_wm_*.json de uma data (default: hoje)
 *   2. Extrai: descrição da tarefa, intent, tool usada, resultado, status
 *   3. Gera um único YYYY-MM-DD_consolidated.md com o resumo do dia
 *   4. Remove os JSONs individuais após consolidação
 *
 * Uso:
 *   node consolidate_rag.js              # consolida hoje
 *   node consolidate_rag.js 2026-05-30   # consolida data específica
 *   node consolidate_rag.js --all        # consolida todas as datas com JSONs
 *   node consolidate_rag.js --dry-run    # só mostra o que faria, sem deletar
 */

import fs from 'fs';
import path from 'path';

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || '/app/cerebro-root';
const RAG_DIR = path.join(WORKSPACE_ROOT, 'Cerebro/Memoria-RAG');

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const doAll = args.includes('--all');
const targetDate = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) || new Date().toISOString().slice(0, 10);

// ---- Detecta datas com JSONs pendentes ----
function getDatesWithJsons() {
    const pattern = /^(\d{4}-\d{2}-\d{2})_wm_[a-f0-9]+\.json$/;
    const files = fs.readdirSync(RAG_DIR);
    const dates = new Set();
    for (const f of files) {
        const m = f.match(pattern);
        if (m) dates.add(m[1]);
    }
    return [...dates].sort();
}

// ---- Lê e parseia todos os wm_*.json de uma data ----
function loadJsonsForDate(date) {
    const pattern = new RegExp(`^${date}_wm_[a-f0-9]+\.json$`);
    const files = fs.readdirSync(RAG_DIR).filter(f => pattern.test(f)).sort();
    const tasks = [];
    for (const f of files) {
        try {
            const raw = JSON.parse(fs.readFileSync(path.join(RAG_DIR, f), 'utf8'));
            tasks.push({
                file: f,
                id: raw.task_id?.slice(0, 8) || '?',
                description: raw.task_description || '(sem descrição)',
                status: raw.status || 'unknown',
                started: raw.started_at || '',
                finished: raw.finished_at || '',
                dispatch: raw.steps_completed?.find(s => s.action === 'dispatch')?.result || '',
                tool: raw.steps_completed?.find(s => s.action?.startsWith('tool_exec:'))?.action?.replace('tool_exec:', '') || null,
                result_snippet: raw.summary?.slice(0, 120) || ''
            });
        } catch (e) {
            tasks.push({ file: f, id: '?', description: '(JSON inválido)', status: 'error', dispatch: '', tool: null, result_snippet: '' });
        }
    }
    return tasks;
}

// ---- Gera o markdown consolidado ----
function buildConsolidatedMd(date, tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const failed = tasks.filter(t => t.status !== 'completed').length;
    const tools = [...new Set(tasks.filter(t => t.tool).map(t => t.tool))];

    // Agrupa por tool para resumo de frequência
    const toolCounts = {};
    for (const t of tasks) {
        if (t.tool) toolCounts[t.tool] = (toolCounts[t.tool] || 0) + 1;
    }
    const toolSummary = Object.entries(toolCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([tool, count]) => `  - ${tool}: ${count}x`)
        .join('\n');

    // Agrupa por intent
    const intents = {};
    for (const t of tasks) {
        const intentMatch = t.dispatch.match(/intent=(\w+)/);
        const intent = intentMatch?.[1] || 'UNKNOWN';
        intents[intent] = (intents[intent] || 0) + 1;
    }
    const intentSummary = Object.entries(intents)
        .sort((a, b) => b[1] - a[1])
        .map(([intent, count]) => `  - ${intent}: ${count}x`)
        .join('\n');

    // Lista de tarefas (apenas as únicas/relevantes — sem repetições de kanban/status)
    const BORING_PATTERNS = [
        /^(tarefas|kanban|status|ram|identidade|saude|ferramentas|git status|disco)$/i,
        /^como esta o sistema/i,
        /^quais (são|sao) (suas|minhas|as)/i,
    ];
    const interesting = tasks.filter(t => 
        !BORING_PATTERNS.some(p => p.test(t.description.trim()))
    );

    let taskList = '';
    if (interesting.length > 0) {
        taskList = '\n## Interações Relevantes\n\n';
        for (const t of interesting.slice(0, 30)) { // max 30 para não inflar
            const icon = t.status === 'completed' ? '✅' : '❌';
            const toolTag = t.tool ? ` [${t.tool}]` : '';
            taskList += `- ${icon} **${t.description.slice(0, 80)}**${toolTag}\n`;
            if (t.result_snippet && t.result_snippet.length > 10) {
                const snippet = t.result_snippet
                    .replace(/\n/g, ' ')
                    .replace(/[{}"]/g, '')
                    .slice(0, 100);
                taskList += `  > ${snippet}\n`;
            }
        }
    }

    return [
        `# Memória Consolidada — ${date}`,
        '',
        `> Gerado automaticamente por \`consolidate_rag.js\` a partir de ${total} working memories individuais.`,
        '',
        '## Resumo do Dia',
        '',
        `- **Total de interações:** ${total}`,
        `- **Concluídas:** ${completed} | **Falhas:** ${failed}`,
        `- **Ferramentas mais usadas:**`,
        toolSummary || '  - (nenhuma ferramenta usada)',
        `- **Distribuição de intents:**`,
        intentSummary || '  - (n/a)',
        taskList,
        '## Palavras-chave',
        `#consolidated #working-memory #${date}`,
    ].join('\n');
}

// ---- Consolida uma data ----
function consolidateDate(date) {
    const tasks = loadJsonsForDate(date);
    if (tasks.length === 0) {
        console.log(`[${date}] Nenhum JSON encontrado. Pulando.`);
        return;
    }

    const outPath = path.join(RAG_DIR, `${date}_consolidated.md`);
    
    // Não sobrescreve se já existe e não é dry-run
    if (fs.existsSync(outPath) && !isDryRun) {
        console.log(`[${date}] Já existe ${path.basename(outPath)}. Sobrescrevendo com dados atualizados.`);
    }

    const md = buildConsolidatedMd(date, tasks);
    
    if (isDryRun) {
        console.log(`[DRY-RUN] ${date}: ${tasks.length} JSONs → ${path.basename(outPath)}`);
        console.log(`--- preview (primeiras 10 linhas) ---`);
        console.log(md.split('\n').slice(0, 10).join('\n'));
        console.log('---');
        return;
    }

    fs.writeFileSync(outPath, md, 'utf8');
    console.log(`[${date}] ✅ ${path.basename(outPath)} gerado (${tasks.length} JSONs consolidados).`);

    // Remove os JSONs individuais
    let deleted = 0;
    for (const t of tasks) {
        try {
            fs.unlinkSync(path.join(RAG_DIR, t.file));
            deleted++;
        } catch (e) {
            console.warn(`  [WARN] Não foi possível remover ${t.file}: ${e.message}`);
        }
    }
    console.log(`[${date}] 🗑️  ${deleted} JSONs individuais removidos.`);
}

// ---- Main ----
const dates = doAll ? getDatesWithJsons() : [targetDate];

if (dates.length === 0) {
    console.log('Nenhuma data com JSONs de working memory encontrada.');
    process.exit(0);
}

console.log(`Consolidando ${dates.length} data(s): ${dates.join(', ')}${isDryRun ? ' [DRY-RUN]' : ''}`);
for (const d of dates) consolidateDate(d);
console.log('Concluído.');
