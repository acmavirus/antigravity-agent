// Copyright by AcmaTvirus
document.addEventListener('DOMContentLoaded', () => {
    const vscode = acquireVsCodeApi();

    // State để tránh re-render khi dữ liệu không đổi
    let lastSnapshots = {
        accounts: '',
        logs: '',
        analytics: ''
    };

    window.addEventListener('message', event => {
        const message = event.data;
        if (message.type === 'update') {
            // Chỉ render Accounts nếu có thay đổi
            const accountsSnap = JSON.stringify(message.accounts);
            if (accountsSnap !== lastSnapshots.accounts) {
                lastSnapshots.accounts = accountsSnap;
                renderAccounts(message.accounts);
            }

            // Chỉ render Logs nếu có thay đổi
            const logsSnap = JSON.stringify(message.logs);
            if (logsSnap !== lastSnapshots.logs) {
                lastSnapshots.logs = logsSnap;
                renderLogs(message.logs);
            }

            // Chỉ render Analytics nếu có thay đổi
            const analyticsSnap = JSON.stringify(message.analytics);
            if (analyticsSnap !== lastSnapshots.analytics) {
                lastSnapshots.analytics = analyticsSnap;
                renderAnalytics(message.analytics);
            }
        }
    });

    const refreshBtn = document.getElementById('refreshBtn');
    const addBtn = document.getElementById('addBtn');
    const autoImportBtn = document.getElementById('autoImportBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const closeSettingsBtn = document.getElementById('closeSettingsBtn');
    const clearLogsBtn = document.getElementById('clearLogsBtn');
    const settingsPanel = document.getElementById('settings-panel');

    // UI Configuration State
    let config = vscode.getState() || {
        theme: 'auto',
        accentColor: '#38bdf8',
        activeTab: 'accounts',
        collapsedAccounts: []
    };

    // Initialize UI from config
    applyConfig(config);

    function applyConfig(newConfig) {
        config = { ...config, ...newConfig };
        vscode.setState(config);

        // Apply Theme
        document.body.className = '';
        if (config.theme !== 'auto') document.body.classList.add(`theme-${config.theme}`);

        // Apply Accent Color
        if (config.theme !== 'auto') {
            document.documentElement.style.setProperty('--accent', config.accentColor);
            document.documentElement.style.setProperty('--accent-glow', config.accentColor + '4d');
        } else {
            document.documentElement.style.removeProperty('--accent');
            document.documentElement.style.removeProperty('--accent-glow');
        }

        // Update Tabs UI
        document.querySelectorAll('.tab-item').forEach(tab => {
            const isActive = tab.dataset.tab === config.activeTab;
            tab.classList.toggle('active', isActive);
            const pane = document.getElementById(`${tab.dataset.tab}-tab`);
            if (pane) pane.classList.toggle('active', isActive);
        });

        // Update Settings UI
        document.querySelectorAll('.theme-opt').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.theme === config.theme);
        });
        document.querySelectorAll('.color-opt').forEach(opt => {
            opt.classList.toggle('active', opt.dataset.color === config.accentColor);
        });
    }

    // Tab Switching
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.addEventListener('click', () => {
            applyConfig({ activeTab: tab.dataset.tab });
        });
    });

    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'clearLogs' });
        });
    }

    // Settings Panel Event Listeners
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            settingsPanel.classList.remove('hidden');
        });
    }

    if (closeSettingsBtn) {
        closeSettingsBtn.addEventListener('click', () => {
            settingsPanel.classList.add('hidden');
        });
    }

    document.querySelectorAll('.theme-opt').forEach(opt => {
        opt.addEventListener('click', () => applyConfig({ theme: opt.dataset.theme }));
    });

    document.querySelectorAll('.color-opt').forEach(opt => {
        opt.addEventListener('click', () => applyConfig({ accentColor: opt.dataset.color }));
    });

    // Lưu trữ trạng thái thu gọn của các card
    let collapsedAccounts = new Set(config.collapsedAccounts);

    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'refresh' });
        });
    }

    if (addBtn) {
        addBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'addAccount' });
        });
    }

    if (autoImportBtn) {
        autoImportBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'autoImport' });
        });
    }

    // Xử lý Xóa, Chuyển tài khoản và Thu gọn qua Event Delegation
    document.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-btn');
        if (deleteBtn) {
            const id = deleteBtn.getAttribute('data-id');
            vscode.postMessage({ type: 'deleteAccount', id: id });
            return;
        }

        const switchBtn = e.target.closest('.switch-btn');
        if (switchBtn) {
            const id = switchBtn.getAttribute('data-id');
            vscode.postMessage({ type: 'switchAccount', id: id });
            return;
        }

        const cardHeader = e.target.closest('.card-header');
        if (cardHeader && !e.target.closest('.header-right')) {
            const card = cardHeader.parentElement;
            const id = card.getAttribute('data-acc-id');
            card.classList.toggle('collapsed');

            if (card.classList.contains('collapsed')) {
                collapsedAccounts.add(id);
            } else {
                collapsedAccounts.delete(id);
            }
            config.collapsedAccounts = Array.from(collapsedAccounts);
            vscode.setState(config);
        }
    });

    function renderAccounts(accounts) {
        const container = document.getElementById('account-list');
        if (!container) return;

        if (accounts.length === 0) {
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
            const switchButton = acc.isActive ?
                `<span class="active-label"><i class="codicon codicon-check"></i> In Use</span>` :
                `<button class="switch-btn" data-id="${acc.id}">Use</button>`;

            card.innerHTML = `
                <div class="card-header">
                    <div class="header-left">
                        <i class="codicon codicon-chevron-down toggle-icon"></i>
                        <span class="account-name">${acc.name}</span>
                    </div>
                    <div class="header-right">
                        ${acc.isActive ? '<span class="status-indicator"></span>' : ''}
                        <span class="status-badge ${statusClass}"></span>
                        <button class="delete-btn" data-id="${acc.id}" title="Remove Account"><i class="codicon codicon-close"></i></button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="quotas">
                        ${acc.quotas.length > 0 ? acc.quotas.map(q => {
                const percentRemaining = q.percent;
                const colorClass = percentRemaining < 10 ? 'critical' : (percentRemaining < 30 ? 'warning' : '');
                return `
                                <div class="quota-item">
                                    <div class="meta">
                                        <span>${q.displayName}</span>
                                        <span>${percentRemaining}%</span>
                                    </div>
                                    <div class="progress-container">
                                        <div class="progress-bar ${colorClass}" style="width: ${percentRemaining}%"></div>
                                    </div>
                                    <div class="meta">
                                        <span class="reset-time"><i class="codicon codicon-history"></i> ${q.resetTime}</span>
                                    </div>
                                </div>
                            `;
            }).join('') : '<div class="meta">No quota data available.</div>'}
                    </div>
                    <div class="card-footer">
                        ${switchButton}
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
                <div class="log-msg">
                    <span class="log-source">[${log.source}]</span>
                    ${log.message}
                </div>
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
        const maxRequests = Math.max(...data.map(d => d.requests || 0), 1);

        container.innerHTML = data.map(d => {
            const height = (d.tokens / maxTokens) * 100;
            // Hiển thị ngày/tháng từ YYYY-MM-DD
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
});
