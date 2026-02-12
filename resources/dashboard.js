// Copyright by AcmaTvirus
document.addEventListener('DOMContentLoaded', () => {
    const vscode = acquireVsCodeApi();

    // 1. State & Variables (Defined FIRST)
    let lastSnapshots = { accounts: '', logs: '', analytics: '', monitor: '' };
    let config = vscode.getState() || {
        theme: 'auto',
        accentColor: '#38bdf8',
        activeTab: 'accounts',
        collapsedAccounts: [],
        lastData: null
    };
    let collapsedAccounts = new Set(config.collapsedAccounts);

    // 2. DOM Elements
    const refreshBtn = document.getElementById('refreshBtn');
    const addBtn = document.getElementById('addBtn');
    const autoImportBtn = document.getElementById('autoImportBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const clearLogsBtn = document.getElementById('clearLogsBtn');
    const settingsPanel = document.getElementById('settings-panel');

    // 3. Render Functions (Hoisted, but kept here for clarity)
    function renderAccounts(accounts) {
        const container = document.getElementById('account-list');
        if (!container) return;
        if (!accounts || accounts.length === 0) {
            container.innerHTML = '<div class="empty-state">No accounts yet. Click "+" to add.</div>';
            return;
        }
        container.innerHTML = '';
        accounts.forEach(acc => {
            const isCollapsed = collapsedAccounts.has(acc.id);
            const card = document.createElement('div');
            card.className = `card ${acc.isActive ? 'active' : ''} ${isCollapsed ? 'collapsed' : ''}`;
            card.setAttribute('data-acc-id', acc.id);
            const statusClass = acc.status === 'active' ? 'status-active' : 'status-forbidden';
            card.innerHTML = `
                <div class="card-header">
                    <div class="header-left">
                        <i class="codicon codicon-chevron-down toggle-icon"></i>
                        <span class="account-name">${acc.name}</span>
                    </div>
                    <div class="header-right">
                        ${!acc.isActive ? `<button class="switch-btn" data-id="${acc.id}" title="Switch Account"><i class="codicon codicon-play"></i></button>` : '<span class="active-badge" title="Active Account"><i class="codicon codicon-check"></i></span>'}
                        <span class="status-badge ${statusClass}"></span>
                        <button class="delete-btn" data-id="${acc.id}" title="Remove Account"><i class="codicon codicon-close"></i></button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="quotas">
                        ${acc.quotas && acc.quotas.length > 0 ? acc.quotas.map(q => {
                const percentRemaining = q.percent;
                const colorClass = percentRemaining < 10 ? 'critical' : (percentRemaining < 30 ? 'warning' : '');
                return `
                                <div class="quota-item">
                                    <span class="status-dot ${colorClass}"></span>
                                    <span class="model-name" title="${q.displayName}">${q.displayName}</span>
                                    <div class="progress-container">
                                        <div class="progress-bar ${colorClass}" style="width: ${percentRemaining}%"></div>
                                    </div>
                                    <span class="percent-text">${percentRemaining.toFixed(2)}%</span>
                                    <span class="arrow-icon">→</span>
                                    <span class="reset-time">${q.resetTime}</span>
                                </div>
                            `;
            }).join('') : '<div class="empty-state">No quota data.</div>'}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    function renderLogs(logs) {
        const container = document.getElementById('log-list');
        if (!container || !logs) return;
        if (logs.length === 0) {
            container.innerHTML = '<div class="empty-state">No activities yet.</div>';
            return;
        }
        container.innerHTML = logs.map(log => `
            <div class="log-entry level-${log.level}">
                <span class="log-time">${new Date(log.timestamp).toLocaleTimeString()}</span>
                <div class="log-msg"><span class="log-source">[${log.source}]</span> ${log.message}</div>
            </div>
        `).join('');
    }

    function renderAnalytics(data) {
        const container = document.getElementById('analytics-chart');
        if (!container || !data) return;
        if (data.length === 0) {
            container.innerHTML = '<div class="empty-state">No statistical data available.</div>';
            return;
        }
        const maxTokens = Math.max(...data.map(d => d.tokens || 0), 1);
        container.innerHTML = data.map(d => {
            const height = (d.tokens / maxTokens) * 100;
            let displayDate = d.date;
            if (d.date.includes('-')) {
                const parts = d.date.split('-');
                displayDate = `${parts[2]}/${parts[1]}`;
            }
            return `
                <div class="bar-wrapper" title="${d.date}: ${d.tokens} tokens, ${d.requests} requests">
                    <div class="bar" style="height: ${Math.max(height, 5)}%"></div>
                    <span class="bar-label">${displayDate}</span>
                </div>
            `;
        }).join('');
    }

    function renderMonitor(data) {
        const container = document.getElementById('monitor-target-list');
        const badge = document.getElementById('monitor-status-badge');
        if (!container) return;
        if (badge && data) {
            const activeCount = data.filter(d => d.connected).length;
            badge.innerText = `CDP: ${activeCount > 0 ? 'Active (' + activeCount + ')' : 'Idle'}`;
            badge.className = `badge ${activeCount > 0 ? 'success' : ''}`;
        }
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-state">No active sessions found.</div>';
            return;
        }
        container.innerHTML = data.map(item => `
            <div class="monitor-card ${item.connected ? 'online' : 'offline'}">
                <div class="monitor-item-header">
                    <span class="port-label">ID / Port</span>
                    <span class="status-text">${item.connected ? 'CONNECTED' : 'DISCONNECTED'}</span>
                </div>
                <div class="monitor-id">${item.id}</div>
                <div class="monitor-flags">
                    <span class="flag ${item.injected ? 'active' : ''}">
                        <i class="codicon codicon-bracket-dot"></i> Injected
                    </span>
                    <span class="flag ${item.connected ? 'active' : ''}">
                        <i class="codicon codicon-zap"></i> Live
                    </span>
                </div>
            </div>
        `).join('');
    }

    function applyConfig(newConfig) {
        config = { ...config, ...newConfig };
        vscode.setState(config);
        document.body.className = '';
        if (config.theme !== 'auto') document.body.classList.add(`theme-${config.theme}`);
        if (config.theme !== 'auto') {
            document.documentElement.style.setProperty('--accent', config.accentColor);
            document.documentElement.style.setProperty('--accent-glow', config.accentColor + '4d');
        } else {
            document.documentElement.style.removeProperty('--accent');
            document.documentElement.style.removeProperty('--accent-glow');
        }
        document.querySelectorAll('.tab-item').forEach(tab => {
            const isActive = tab.dataset.tab === config.activeTab;
            tab.classList.toggle('active', isActive);
            const pane = document.getElementById(`${tab.dataset.tab}-tab`);
            if (pane) pane.classList.toggle('active', isActive);
        });
        document.querySelectorAll('.theme-opt').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.theme === config.theme);
        });
        document.querySelectorAll('.color-opt').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.color === config.accentColor);
        });
    }

    // 4. Initial Logic Execution
    // Render từ cache ngay lập tức
    if (config.lastData) {
        const m = config.lastData;
        if (m.accounts) { lastSnapshots.accounts = JSON.stringify(m.accounts); renderAccounts(m.accounts); }
        if (m.logs) { lastSnapshots.logs = JSON.stringify(m.logs); renderLogs(m.logs); }
        if (m.analytics) { lastSnapshots.analytics = JSON.stringify(m.analytics); renderAnalytics(m.analytics); }
        if (m.monitor) { lastSnapshots.monitor = JSON.stringify(m.monitor); renderMonitor(m.monitor); }
    }
    applyConfig(config);

    // 5. Event Listeners
    window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'update') {
            config.lastData = message;
            vscode.setState(config);
            const accSnap = JSON.stringify(message.accounts);
            if (accSnap !== lastSnapshots.accounts) { lastSnapshots.accounts = accSnap; renderAccounts(message.accounts); }
            const logSnap = JSON.stringify(message.logs);
            if (logSnap !== lastSnapshots.logs) { lastSnapshots.logs = logSnap; renderLogs(message.logs); }
            const anaSnap = JSON.stringify(message.analytics);
            if (anaSnap !== lastSnapshots.analytics) { lastSnapshots.analytics = anaSnap; renderAnalytics(message.analytics); }
            const monSnap = JSON.stringify(message.monitor);
            if (monSnap !== lastSnapshots.monitor) { lastSnapshots.monitor = monSnap; renderMonitor(message.monitor); }
        }
    });

    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.addEventListener('click', () => applyConfig({ activeTab: tab.dataset.tab }));
    });

    if (refreshBtn) refreshBtn.addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
    if (addBtn) addBtn.addEventListener('click', () => vscode.postMessage({ type: 'addAccount' }));
    if (autoImportBtn) autoImportBtn.addEventListener('click', () => vscode.postMessage({ type: 'autoImport' }));
    if (clearLogsBtn) clearLogsBtn.addEventListener('click', () => vscode.postMessage({ type: 'clearLogs' }));

    if (settingsBtn) settingsBtn.addEventListener('click', () => settingsPanel.classList.add('active'));
    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => settingsPanel.classList.remove('active'));

    document.querySelectorAll('.theme-opt').forEach(opt => {
        opt.addEventListener('click', () => applyConfig({ theme: opt.dataset.theme }));
    });
    document.querySelectorAll('.color-opt').forEach(opt => {
        opt.addEventListener('click', () => applyConfig({ accentColor: opt.dataset.color }));
    });

    // Delegation cho card-header toggle
    document.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) { vscode.postMessage({ type: 'deleteAccount', id: deleteBtn.getAttribute('data-id') }); return; }
        const switchBtn = e.target.closest('.switch-btn');
        if (switchBtn) { vscode.postMessage({ type: 'switchAccount', id: switchBtn.getAttribute('data-id') }); return; }

        const cardHeader = e.target.closest('.card-header');
        if (cardHeader && !e.target.closest('.header-right')) {
            const card = cardHeader.parentElement;
            const id = card.getAttribute('data-acc-id');
            card.classList.toggle('collapsed');
            if (card.classList.contains('collapsed')) collapsedAccounts.add(id);
            else collapsedAccounts.delete(id);
            config.collapsedAccounts = Array.from(collapsedAccounts);
            vscode.setState(config);
        }
    });

});
