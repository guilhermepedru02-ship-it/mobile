/**
 * app.js — Hub PWA Logic
 * Comunica com Android Bridge e MCP via fetch local
 */

const BRIDGE_BASE = 'http://127.0.0.1:4444';
const MCP_BASE   = 'http://127.0.0.1:3001';

const App = {

  // -----------------------------------------------------------------------
  // TABS
  // -----------------------------------------------------------------------
  initTabs() {
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
        if (btn.dataset.tab === 'kanban') App.loadKanban();
      });
    });
  },

  // -----------------------------------------------------------------------
  // TOAST
  // -----------------------------------------------------------------------
  toast(msg, duration = 2500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), duration);
  },

  // -----------------------------------------------------------------------
  // BRIDGE: requisicão autenticada
  // -----------------------------------------------------------------------
  async bridgeRequest(route, body = {}) {
    const token = localStorage.getItem('BRIDGE_TOKEN') || '';
    try {
      const r = await fetch(`${BRIDGE_BASE}/bridge/${route}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      return await r.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

  // -----------------------------------------------------------------------
  // DASHBOARD
  // -----------------------------------------------------------------------
  async refreshDashboard() {
    App.toast('Atualizando...');
    await Promise.all([
      App.fetchBattery(),
      App.fetchWifi(),
      App.checkServices()
    ]);
  },

  async fetchBattery() {
    const data = await App.bridgeRequest('battery');
    if (data.success && data.data) {
      const d = data.data;
      document.getElementById('val-battery').textContent = `${d.percentage ?? '--'}%`;
      document.getElementById('sub-battery').textContent =
        `${d.status ?? ''} · ${d.temperature ? d.temperature.toFixed(1) + '°C' : ''}`;
    } else {
      document.getElementById('val-battery').textContent = 'ERR';
      document.getElementById('sub-battery').textContent = data.error || 'bridge offline';
    }
  },

  async fetchWifi() {
    const data = await App.bridgeRequest('wifi');
    if (data.success && data.data) {
      const d = data.data;
      document.getElementById('val-wifi').textContent =
        d.ssid ? d.ssid.substring(0, 12) : '--';
      document.getElementById('sub-wifi').textContent =
        `${d.ip ? d.ip : ''} · ${d.link_speed_mbps ? d.link_speed_mbps + ' Mbps' : ''}`;
    } else {
      document.getElementById('val-wifi').textContent = 'N/A';
      document.getElementById('sub-wifi').textContent = data.error || '';
    }
  },

  async checkServices() {
    const services = [
      { id: 'svc-llama',  port: 11434, path: '/' },
      { id: 'svc-mcp',   port: 3001,  path: '/health' },
      { id: 'svc-agent', port: 3333,  path: '/status' },
      { id: 'svc-api',   port: 4000,  path: '/api/status' },
      { id: 'svc-bridge',port: 4444,  path: '/bridge/status' }
    ];

    const bridgeDot = document.getElementById('bridgeDot');
    const bridgeLabel = document.getElementById('bridgeLabel');

    for (const svc of services) {
      const el = document.getElementById(svc.id);
      if (!el) continue;
      el.textContent = '...';
      el.className = 'svc-dot checking';
      try {
        const r = await fetch(`http://127.0.0.1:${svc.port}${svc.path}`, { signal: AbortSignal.timeout(2500) });
        if (r.ok || r.status < 500) {
          el.textContent = '● online';
          el.className = 'svc-dot running';
          if (svc.port === 4444) {
            bridgeDot.classList.add('online');
            bridgeLabel.textContent = 'online';
          }
        } else {
          throw new Error(`HTTP ${r.status}`);
        }
      } catch (e) {
        el.textContent = '● offline';
        el.className = 'svc-dot offline';
        if (svc.port === 4444) {
          bridgeDot.classList.remove('online');
          bridgeDot.classList.add('offline');
          bridgeLabel.textContent = 'offline';
        }
      }
    }
  },

  // -----------------------------------------------------------------------
  // BRIDGE TAB — Leitura
  // -----------------------------------------------------------------------
  async bridge(route) {
    const output = document.getElementById('bridgeOutput');
    output.textContent = `⏳ Chamando /bridge/${route}...`;
    const data = await App.bridgeRequest(route);
    output.textContent = JSON.stringify(data, null, 2);
    App.toast(data.success ? '✅ Sucesso' : '❌ Erro');
  },

  // -----------------------------------------------------------------------
  // BRIDGE TAB — Notificação
  // -----------------------------------------------------------------------
  async sendNotification() {
    const title = document.getElementById('notif-title').value.trim();
    const content = document.getElementById('notif-content').value.trim();
    if (!title || !content) { App.toast('⚠️ Preencha título e conteúdo'); return; }

    const output = document.getElementById('bridgeOutput');
    output.textContent = '⏳ Enviando notificação...';
    const data = await App.bridgeRequest('notification', { title, content });
    output.textContent = JSON.stringify(data, null, 2);
    App.toast(data.success ? '🔔 Notificação enviada!' : '❌ Erro: ' + data.error);
  },

  // -----------------------------------------------------------------------
  // BRIDGE TAB — TTS
  // -----------------------------------------------------------------------
  async sendTTS() {
    const text = document.getElementById('tts-text').value.trim();
    if (!text) { App.toast('⚠️ Digite o texto'); return; }

    const output = document.getElementById('bridgeOutput');
    output.textContent = '⏳ Falando...';
    const data = await App.bridgeRequest('tts', { text });
    output.textContent = JSON.stringify(data, null, 2);
    App.toast(data.success ? '🔊 Falando!' : '❌ Erro');
  },

  // -----------------------------------------------------------------------
  // BRIDGE TAB — Abrir App
  // -----------------------------------------------------------------------
  async openApp() {
    const pkg = document.getElementById('intent-pkg').value.trim();
    if (!pkg) { App.toast('⚠️ Digite o package name'); return; }

    const output = document.getElementById('bridgeOutput');
    output.textContent = `⏳ Abrindo ${pkg}...`;
    const data = await App.bridgeRequest('intent/open', { package: pkg });
    output.textContent = JSON.stringify(data, null, 2);
    App.toast(data.success ? `📱 App aberto!` : '❌ Erro: ' + data.error);
  },

  // -----------------------------------------------------------------------
  // KANBAN
  // -----------------------------------------------------------------------
  async loadKanban() {
    const output = document.getElementById('kanbanOutput');
    output.textContent = '⏳ Lendo kanban.md...';
    try {
      const r = await fetch('/hub/kanban', { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      output.textContent = data.content || '(vazio)';
    } catch (e) {
      output.textContent = `Erro ao carregar kanban: ${e.message}\n\nVerifique se o Hub Server está rodando corretamente.`;
    }
  },

  // -----------------------------------------------------------------------
  // AUDITORIA
  // -----------------------------------------------------------------------
  async loadAudit() {
    const ownerKey = document.getElementById('owner-key').value.trim();
    if (!ownerKey) { App.toast('⚠️ Informe a Owner Key'); return; }

    const output = document.getElementById('auditOutput');
    output.textContent = '⏳ Carregando log...';

    try {
      const r = await fetch(`${BRIDGE_BASE}/bridge/audit?lines=100`, {
        headers: { 'X-Owner-Key': ownerKey }
      });
      const data = await r.json();
      if (data.success) {
        output.textContent = `=== STATS ===\n${JSON.stringify(data.stats, null, 2)}\n\n=== LOG (${data.lines_retornadas} linhas) ===\n${data.log}`;
      } else {
        output.textContent = 'Erro: ' + (data.error || 'Desconhecido');
      }
    } catch (e) {
      output.textContent = `Erro: ${e.message}`;
    }
  },

  // -----------------------------------------------------------------------
  // INIT
  // -----------------------------------------------------------------------
  init() {
    App.initTabs();
    App.refreshDashboard();

    // Prompt de token se não configurado
    if (!localStorage.getItem('BRIDGE_TOKEN')) {
      const token = prompt('⚡ Hub PWA: Configure o BRIDGE_TOKEN_CLAUDE para usar a bridge.\n\nCole o token aqui:');
      if (token) localStorage.setItem('BRIDGE_TOKEN', token);
    }
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
