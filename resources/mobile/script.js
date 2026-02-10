// Copyright by AcmaTvirus
document.addEventListener('DOMContentLoaded', () => {
    let currentData = null;

    // Tab Switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.dataset.tab + '-tab';
            document.getElementById(tabId).classList.add('active');
        });
    });

    // Fetch Data
    async function fetchData() {
        try {
            const res = await fetch('/api/status');
            const data = await res.json();
            currentData = data;
            renderAll();
        } catch (e) {
            console.error('Fetch error:', e);
            document.getElementById('connection-status').innerText = 'OFFLINE';
            document.getElementById('live-dot').style.backgroundColor = 'var(--danger)';
        }
    }

    function renderAll() {
        if (!currentData) return;

        // Header and Stats
        document.getElementById('connection-status').innerText = 'LIVE';
        document.getElementById('live-dot').style.backgroundColor = 'var(--success)';
        document.getElementById('active-sessions-count').innerText = currentData.monitor.filter(m => m.connected).length;

        // Render Accounts
        const accList = document.getElementById('account-list');
        accList.innerHTML = currentData.accounts.map(acc => `
            <div class="acc-card ${acc.isActive ? 'active' : ''}" onclick="switchAccount('${acc.id}')">
                <div class="acc-info">
                    <span class="name">${acc.name}</span>
                    <span class="badge ${acc.isActive ? 'active' : ''}">${acc.isActive ? 'ĐANG DÙNG' : 'SẴN SÀNG'}</span>
                </div>
                <div class="quota-mini">
                    ${acc.quotas.length > 0 ? acc.quotas.map(q => {
            const colorClass = q.percent < 10 ? 'danger' : (q.percent < 30 ? 'warning' : '');
            return `
                            <div class="q-row">
                                <div class="q-label-row">
                                    <span>${q.displayName}</span>
                                    <span>${q.percent}%</span>
                                </div>
                                <div class="q-bar-bg">
                                    <div class="q-bar ${colorClass}" style="width: ${q.percent}%"></div>
                                </div>
                            </div>
                        `;
        }).join('') : '<div class="q-label-row">Không có dữ liệu quota</div>'}
                </div>
            </div>
        `).join('');

        // Calculate Quota Health (average of active account)
        const activeAcc = currentData.accounts.find(a => a.isActive);
        if (activeAcc && activeAcc.quotas.length > 0) {
            const avg = Math.round(activeAcc.quotas.reduce((acc, curr) => acc + curr.percent, 0) / activeAcc.quotas.length);
            document.getElementById('quota-health-pct').innerText = avg + '%';
        } else {
            document.getElementById('quota-health-pct').innerText = '--%';
        }

        // Render Monitor
        const monList = document.getElementById('monitor-list');
        if (currentData.monitor.length === 0) {
            monList.innerHTML = '<div class="acc-card">Không tìm thấy phiên làm việc nào.</div>';
        } else {
            monList.innerHTML = currentData.monitor.map(m => `
                <div class="mon-card ${m.connected ? 'online' : 'offline'}">
                    <div class="acc-info">
                        <span class="name" style="font-family: monospace; font-size: 0.75rem;">${m.id}</span>
                        <span class="badge">${m.connected ? 'CONNECTED' : 'DISCONNECTED'}</span>
                    </div>
                </div>
            `).join('');
        }

        // Render Analytics (Mini bars)
        const chart = document.getElementById('analytics-chart');
        if (currentData.analytics && currentData.analytics.length > 0) {
            const max = Math.max(...currentData.analytics.map(a => a.tokens), 1);
            chart.innerHTML = currentData.analytics.map(a => {
                const h = (a.tokens / max) * 100;
                return `<div class="c-bar" style="height: ${Math.max(h, 5)}%"></div>`;
            }).join('');
        }

        // Render Logs
        const logCont = document.querySelector('.log-container');
        logCont.innerHTML = currentData.logs.map(log => `
            <div class="log-item">
                <span class="time">${new Date(log.timestamp).toLocaleTimeString()}</span>
                <span>${log.message}</span>
            </div>
        `).join('');
    }

    window.switchAccount = async (id) => {
        if (!confirm('Chuyển sang tài khoản này?')) return;
        await fetch(`/api/switch/${id}`, { method: 'POST' });
        fetchData();
    };

    document.getElementById('refresh-btn').onclick = async () => {
        await fetch('/api/refresh', { method: 'POST' });
        fetchData();
    };

    // Auto Refresh
    setInterval(fetchData, 5000);
    fetchData();
});
