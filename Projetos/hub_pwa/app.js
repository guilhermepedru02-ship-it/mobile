/**
 * app.js — Hub PWA Logic
 * v1.0.3 | Fix SSID: rede Wi-Fi quando Android bloqueia bg | 2026-06-03
 *
 * CORRECOES:
 *  1. bridgeRequest() agora chama /proxy/bridge (mesmo origin, sem CORS)
 *  2. checkServices() chama /hub/services (server-side, sem CORS)
 *  3. loadAudit() chama /proxy/bridge/audit via GET
 */

const App = {

  initTabs() {
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        if (btn.dataset.tab === 'kanban') App.loadKanban();
      });
    });
  },

  toast(msg, duration = 2500) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), duration);
  },

  // FIX: usa /proxy/bridge (mesmo origin) em vez de http://127.0.0.1:4444 diretamente
  async bridgeRequest(route, body = {}) {
    const token = localStorage.getItem('BRIDGE_TOKEN') || '';
    try {
      const r = await fetch('/proxy/bridge/' + route, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bridge-token': token
        },
        body: JSON.stringify(body)
      });
      return await r.json();
    } catch (e) {
      return { success: false, error: e.message };
    }
  },

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
      document.getElementById('val-battery').textContent = (d.percentage != null ? d.percentage : '--') + '%';
      document.getElementById('sub-battery').textContent =
        (d.status || '') + ' · ' + (d.temperature ? d.temperature.toFixed(1) + '°C' : '');
    } else {
      document.getElementById('val-battery').textContent = 'ERR';
      document.getElementById('sub-battery').textContent = data.error || 'bridge offline';
    }
  },

  async fetchWifi() {
    const data = await App.bridgeRequest('wifi');
    if (data.success && data.data) {
      const d = data.data;
      const ssid = d.ssid || ''; const isUnknown = !ssid || ssid === '<unknown ssid>'; const label = isUnknown ? 'rede Wi-Fi' : (ssid + (d.ssid_cached ? ' *' : '')); document.getElementById('val-wifi').textContent = label;
      document.getElementById('sub-wifi').textContent =
        (d.ip || '') + ' · ' + (d.link_speed_mbps ? d.link_speed_mbps + ' Mbps' : '');
    } else {
      document.getElementById('val-wifi').textContent = 'N/A';
      document.getElementById('sub-wifi').textContent = data.error || '';
    }
  },

  // FIX: chama /hub/services (server-side) em vez de cada porta diretamente
  async checkServices() {
    const ids = ['svc-llama', 'svc-mcp', 'svc-agent', 'svc-api', 'svc-bridge'];
    const bridgeDot   = document.getElementById('bridgeDot');
    const bridgeLabel = document.getElementById('bridgeLabel');

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = '...'; el.className = 'svc-dot checking'; }
    });

    try {
      const r = await fetch('/hub/services', { signal: AbortSignal.timeout(10000) });
      const data = await r.json();
      if (!data.success) throw new Error('hub/services falhou');

      ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const online = data.services[id]?.online;
        el.textContent = online ? '● online' : '● offline';
        el.className = 'svc-dot ' + (online ? 'running' : 'offline');
        if (id === 'svc-bridge') {
          bridgeDot.classList.toggle('online', !!online);
          bridgeDot.classList.toggle('offline', !online);
          bridgeLabel.textContent = online ? 'online' : 'offline';
        }
      });
    } catch (e) {
      ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.textContent = '● erro'; el.className = 'svc-dot offline'; }
      });
    }
  },

  async bridge(route) {
    const output = document.getElementById('bridgeOutput');
    output.textContent = 'Chamando /bridge/' + route + '...';
    const data = await App.bridgeRequest(route);
    output.textContent = JSON.stringify(data, null, 2);
    App.toast(data.success ? '✅ Sucesso' : '❌ Erro');
  },

  async sendNotification() {
    const title   = document.getElementById('notif-title').value.trim();
    const content = document.getElementById('notif-content').value.trim();
    if (!title || !content) { App.toast('⚠️ Preencha título e conteúdo'); return; }
    const output = document.getElementById('bridgeOutput');
    output.textContent = 'Enviando notificacao...';
    const data = await App.bridgeRequest('notification', { title, content });
    output.textContent = JSON.stringify(data, null, 2);
    App.toast(data.success ? '🔔 Notificacao enviada!' : '❌ Erro: ' + data.error);
  },

  async sendTTS() {
    const text = document.getElementById('tts-text').value.trim();
    if (!text) { App.toast('⚠️ Digite o texto'); return; }
    const output = document.getElementById('bridgeOutput');
    output.textContent = 'Falando...';
    const data = await App.bridgeRequest('tts', { text });
    output.textContent = JSON.stringify(data, null, 2);
    App.toast(data.success ? '🔊 Falando!' : '❌ Erro');
  },

  async openApp() {
    const pkg = document.getElementById('intent-pkg').value.trim();
    if (!pkg) { App.toast('⚠️ Digite o package name'); return; }
    const output = document.getElementById('bridgeOutput');
    output.textContent = 'Abrindo ' + pkg + '...';
    const data = await App.bridgeRequest('intent/open', { package: pkg });
    output.textContent = JSON.stringify(data, null, 2);
    App.toast(data.success ? '📱 App aberto!' : '❌ Erro: ' + data.error);
  },

  async loadKanban() {
    const output = document.getElementById('kanbanOutput');
    output.textContent = 'Lendo kanban.md...';
    try {
      const r = await fetch('/hub/kanban', { signal: AbortSignal.timeout(5000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      output.textContent = data.content || '(vazio)';
    } catch (e) {
      output.textContent = 'Erro ao carregar kanban: ' + e.message;
    }
  },

  // FIX: usa /proxy/bridge/audit (GET via proxy, sem CORS)
  async loadAudit() {
    const ownerKey = document.getElementById('owner-key').value.trim();
    if (!ownerKey) { App.toast('⚠️ Informe a Owner Key'); return; }
    const output = document.getElementById('auditOutput');
    output.textContent = 'Carregando log...';
    try {
      const r = await fetch('/proxy/bridge/audit?lines=100', {
        headers: { 'x-owner-key': ownerKey }
      });
      const data = await r.json();
      if (data.success) {
        output.textContent = '=== STATS ===\n' + JSON.stringify(data.stats, null, 2) +
          '\n\n=== LOG (' + data.lines_retornadas + ' linhas) ===\n' + data.log;
      } else {
        output.textContent = 'Erro: ' + (data.error || 'Desconhecido');
      }
    } catch (e) {
      output.textContent = 'Erro: ' + e.message;
    }
  },

  init() {
    App.initTabs();
    if (!localStorage.getItem('BRIDGE_TOKEN')) {
      const token = prompt('Hub PWA: Configure o BRIDGE_TOKEN_CLAUDE para usar a bridge.\n\nCole o token aqui:');
      if (token) localStorage.setItem('BRIDGE_TOKEN', token.trim());
    }
    App.refreshDashboard();
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
