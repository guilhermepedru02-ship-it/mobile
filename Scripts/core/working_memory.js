import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

const WORKSPACE_ROOT = '/storage/emulated/0/Workspace';
const WM_PATH = path.join(WORKSPACE_ROOT, 'Cerebro/02_Memoria/working_memory_active.json');

// Cria ou sobrescreve a working memory com uma nova tarefa
export function startTask(description) {
    const state = {
        task_id: randomUUID(),
        task_description: description,
        started_at: new Date().toISOString(),
        steps_completed: [],
        steps_pending: [],
        context_variables: {},
        status: 'in_progress'
    };
    fs.writeFileSync(WM_PATH, JSON.stringify(state, null, 2), 'utf8');
    return state;
}

// Lê o estado atual da working memory
export function readTask() {
    if (!fs.existsSync(WM_PATH)) return null;
    try {
        return JSON.parse(fs.readFileSync(WM_PATH, 'utf8'));
    } catch {
        return null;
    }
}

// Registra um passo concluído e persiste
export function completeStep(action, result) {
    const state = readTask();
    if (!state) return;
    const step = {
        step: state.steps_completed.length + 1,
        action,
        result,
        timestamp: new Date().toISOString()
    };
    state.steps_completed.push(step);
    fs.writeFileSync(WM_PATH, JSON.stringify(state, null, 2), 'utf8');
}

// Finaliza a tarefa e arquiva na Memoria-RAG
export function finishTask(summary) {
    const state = readTask();
    if (!state) return;
    state.status = 'completed';
    state.finished_at = new Date().toISOString();
    state.summary = summary;

    // Arquiva na Memoria-RAG
    const date = new Date().toISOString().slice(0, 10);
    const archivePath = path.join(
        WORKSPACE_ROOT,
        `Cerebro/Memoria-RAG/${date}_wm_${state.task_id.slice(0, 8)}.json`
    );
    fs.writeFileSync(archivePath, JSON.stringify(state, null, 2), 'utf8');

    // Limpa a working memory ativa
    fs.unlinkSync(WM_PATH);
    return archivePath;
}
