// Copyright by AcmaTvirus
document.addEventListener('DOMContentLoaded', () => {
    let currentData = null;
    let streamInterval = null;
    let activeTargetId = null;
    let authToken = localStorage.getItem('antigravity_token');

    // Helper fetch có kèm token
    async function authenticatedFetch(url, options = {}) {
        const headers = {
            ...options.headers,
            'Authorization': `Bearer ${authToken}`
        };
        const res = await fetch(url, { ...options, headers });
        if (res.status === 401) {
            showLogin();
            throw new Error('Unauthorized');
        }
        return res;
    }

    // Auth UI Logic
    function showLogin() {
        document.getElementById('login-overlay').style.display = 'flex';
        document.body.classList.add('overflow-hidden');
    }

    function hideLogin() {
        document.getElementById('login-overlay').style.display = 'none';
        document.body.classList.remove('overflow-hidden');
    }

    document.getElementById('login-btn').onclick = async () => {
        const pin = document.getElementById('pin-input').value;
        if (!pin) return;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin })
            });

            if (res.ok) {
                const data = await res.json();
                authToken = data.token;
                localStorage.setItem('antigravity_token', authToken);
                hideLogin();
                fetchData();
            } else {
                alert('Mã PIN không chính xác!');
            }
        } catch (e) {
            alert('Lỗi kết nối server!');
        }
    };

    // Tab Switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });

    function switchTab(tabName) {
        document.querySelectorAll('.tab-btn, .tab-content').forEach(el => el.classList.remove('active'));

        const btn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
        if (btn) btn.classList.add('active');

        const content = document.getElementById(`${tabName}-tab`);
        if (content) content.classList.add('active');

        if (tabName === 'live') {
            document.body.classList.add('live-view-active');
        } else {
            document.body.classList.remove('live-view-active');
            stopLiveView();
        }
    }

    document.querySelector('.back-to-mon').addEventListener('click', () => {
        switchTab('monitor');
    });

    async function fetchData() {
        if (!authToken) { showLogin(); return; }
        try {
            const res = await authenticatedFetch('/api/status');
            const data = await res.json();
            currentData = data;
            renderAll();
        } catch (e) {
            if (e.message !== 'Unauthorized') {
                console.error('Fetch error:', e);
                document.getElementById('connection-status').innerText = 'OFFLINE';
                document.getElementById('live-dot').style.backgroundColor = 'var(--danger)';
            }
        }
    }

    function renderAll() {
        if (!currentData) return;

        document.getElementById('connection-status').innerText = 'LIVE';
        document.getElementById('live-dot').style.backgroundColor = 'var(--success)';
        document.getElementById('active-sessions-count').innerText = currentData.monitor.filter(m => m.connected).length;

        const tunnelArea = document.getElementById('tunnel-area');
        const urlInput = document.getElementById('public-url-input');
        const passInput = document.getElementById('tunnel-pass-input');

        if (currentData.publicUrl) {
            tunnelArea.style.display = 'flex';
            urlInput.value = currentData.publicUrl;
            passInput.value = currentData.tunnelPassword || 'Đang lấy...';
        } else {
            tunnelArea.style.display = 'none';
        }

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

        const activeAcc = currentData.accounts.find(a => a.isActive);
        if (activeAcc && activeAcc.quotas.length > 0) {
            const avg = Math.round(activeAcc.quotas.reduce((acc, curr) => acc + curr.percent, 0) / activeAcc.quotas.length);
            document.getElementById('quota-health-pct').innerText = avg + '%';
        } else {
            document.getElementById('quota-health-pct').innerText = '--%';
        }

        const monList = document.getElementById('monitor-list');
        if (currentData.monitor.length === 0) {
            monList.innerHTML = '<div class="acc-card">Không tìm thấy phiên làm việc nào.</div>';
        } else {
            monList.innerHTML = currentData.monitor.map(m => `
                <div class="mon-card ${m.connected ? 'online' : 'offline'}" onclick="startLiveView('${m.id}')">
                    <div class="acc-info">
                        <span class="name" style="font-family: monospace; font-size: 0.75rem;">${m.id}</span>
                        <span class="badge">${m.connected ? 'BẤM ĐỂ XEM LIVE' : 'DISCONNECTED'}</span>
                    </div>
                </div>
            `).join('');
        }

        const chart = document.getElementById('analytics-chart');
        if (currentData.analytics && currentData.analytics.length > 0) {
            const max = Math.max(...currentData.analytics.map(a => a.tokens), 1);
            chart.innerHTML = currentData.analytics.map(a => {
                const h = (a.tokens / max) * 100;
                return `<div class="c-bar" style="height: ${Math.max(h, 5)}%"></div>`;
            }).join('');
        }

        const logCont = document.querySelector('.log-container');
        logCont.innerHTML = (currentData.logs || []).map(log => `
            <div class="log-item">
                <span class="time">${new Date(log.timestamp).toLocaleTimeString()}</span>
                <span>${log.message}</span>
            </div>
        `).join('');
    }

    function copyToClipboard(inputEl, btnId) {
        inputEl.select();
        document.execCommand('copy');
        const btn = document.getElementById(btnId);
        const icon = btn.querySelector('i');
        const oldClass = icon.className;
        icon.className = 'fas fa-check';
        btn.style.borderColor = 'var(--success)';
        btn.style.color = 'var(--success)';
        setTimeout(() => {
            icon.className = oldClass;
            btn.style.borderColor = '';
            btn.style.color = '';
        }, 2000);
    }

    document.getElementById('copy-url-btn').onclick = () => {
        const urlInput = document.getElementById('public-url-input');
        copyToClipboard(urlInput, 'copy-url-btn');
    };

    document.getElementById('copy-pass-btn').onclick = () => {
        const passInput = document.getElementById('tunnel-pass-input');
        copyToClipboard(passInput, 'copy-pass-btn');
    };

    // Live View Logic
    document.getElementById('toggle-expand-btn').onclick = () => {
        const container = document.getElementById('stream-container');
        const icon = document.querySelector('#toggle-expand-btn i');
        container.classList.toggle('expanded');
        if (container.classList.contains('expanded')) {
            icon.className = 'fas fa-compress';
        } else {
            icon.className = 'fas fa-expand';
        }
    };

    document.querySelectorAll('.focus-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const focus = btn.dataset.focus;
            const img = document.getElementById('stream-img');
            document.querySelectorAll('.focus-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            img.className = '';
            img.classList.add(`focus-${focus}`);
        });
    });

    window.startLiveView = (id) => {
        activeTargetId = id;
        switchTab('live');
        document.getElementById('live-page-title').innerText = 'Live: ' + id;
        if (streamInterval) clearInterval(streamInterval);
        streamInterval = setInterval(updateStream, 2000);
        updateStream();
    };

    function stopLiveView() {
        if (streamInterval) clearInterval(streamInterval);
        streamInterval = null;
        activeTargetId = null;
    }

    async function updateStream() {
        if (!activeTargetId) return;
        try {
            const res = await authenticatedFetch(`/api/screenshot/${activeTargetId}`);
            const blob = await res.blob();
            document.getElementById('stream-img').src = URL.createObjectURL(blob);
        } catch (e) { }
    }

    document.getElementById('send-cmd-btn').onclick = async () => {
        const input = document.getElementById('cmd-input');
        const text = input.value.trim();
        if (!text || !activeTargetId) return;

        input.disabled = true;
        try {
            await authenticatedFetch('/api/inject', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: activeTargetId, text })
            });
            input.value = '';
        } catch (e) { }
        input.disabled = false;
    };

    document.getElementById('accept-btn').onclick = async () => {
        if (!activeTargetId) return;
        const btn = document.getElementById('accept-btn');
        btn.disabled = true;
        try {
            await authenticatedFetch('/api/accept', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: activeTargetId })
            });
            btn.style.backgroundColor = 'white';
            setTimeout(() => btn.style.backgroundColor = '', 200);
        } catch (e) { }
        btn.disabled = false;
    };

    window.switchAccount = async (id) => {
        if (!confirm('Chuyển sang tài khoản này?')) return;
        try {
            await authenticatedFetch(`/api/switch/${id}`, { method: 'POST' });
            fetchData();
        } catch (e) { }
    };

    setInterval(fetchData, 5000);
    fetchData();
});
