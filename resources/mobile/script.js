// Copyright by AcmaTvirus
document.addEventListener('DOMContentLoaded', () => {
    let currentData = null;
    let streamInterval = null;
    let chatInterval = null;
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

        // Cleanup intervals
        if (streamInterval) clearInterval(streamInterval);
        if (chatInterval) clearInterval(chatInterval);

        if (tabName === 'live') {
            document.body.classList.add('live-view-active');
            startChatPolling();
        } else {
            document.body.classList.remove('live-view-active');
            stopLiveView();
        }
    }

    // Chat Logic
    function startChatPolling() {
        updateChatContent();
        chatInterval = setInterval(updateChatContent, 2000);
    }

    async function updateChatContent() {
        if (!authToken) return;
        try {
            const res = await authenticatedFetch('/api/chat/status');
            const data = await res.json();
            renderChat(data);
        } catch (e) { }
    }

    function renderChat(data) {
        if (!data) return;

        // Render Header Stats
        const modeEl = document.getElementById('mode-val');
        const modelEl = document.getElementById('model-val');
        const resInfo = document.querySelector('.resource-info');

        if (modeEl) modeEl.innerHTML = `<i class="fas fa-bolt"></i> ${data.mode || 'Planning'}`;
        if (modelEl) modelEl.innerHTML = `<i class="far fa-circle"></i> ${data.model || 'Gemini 3 Flash'}`;
        if (resInfo) resInfo.innerText = `${data.nodes || 0} Nodes • ${data.mem || '0KB'}`;

        const container = document.getElementById('chat-messages-container');
        if (!container) return;

        if (!data.messages || data.messages.length === 0) {
            if (!container.querySelector('.empty-chat-state')) {
                container.innerHTML = `<div class="empty-chat-state"><i class="fas fa-ghost"></i><p>No active session found.</p></div>`;
            }
            return;
        }

        // Render Messages
        container.innerHTML = data.messages.map(msg => {
            if (msg.type === 'user') {
                return `
                    <div class="user-query-container">
                        <div class="user-query-text">${msg.text}</div>
                        <i class="fas fa-undo undo-icon"></i>
                    </div>
                `;
            } else if (msg.type === 'thought') {
                return `
                    <div class="agent-thought-block" onclick="this.classList.toggle('expanded')">
                        <div class="thought-header">
                            <i class="fas fa-chevron-right"></i>
                            <span>Thought for ${msg.duration || '<1s'}</span>
                        </div>
                        <div class="thought-detail">${msg.content || 'AI is reasoning...'}</div>
                    </div>
                `;
            } else if (msg.type === 'action') {
                return `
                    <div class="agent-action-block">
                        <i class="fas ${msg.action === 'Edited' ? 'fa-file-signature' : 'fa-file-search'}"></i>
                        <span class="action-file">${msg.action} ${msg.file}</span>
                        <span class="action-diff">${msg.diff || ''}</span>
                    </div>
                `;
            } else {
                return `<div class="agent-text-block">${msg.text}</div>`;
            }
        }).join('');

        // Auto Scroll to bottom
        container.scrollTop = container.scrollHeight;
    }

    document.getElementById('send-agent-btn').onclick = async () => {
        const input = document.getElementById('chat-agent-input');
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        try {
            await authenticatedFetch('/api/chat/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });
            updateChatContent();
        } catch (e) { }
    };

    document.getElementById('global-stop-btn').onclick = async () => {
        try {
            await authenticatedFetch('/api/chat/stop', { method: 'POST' });
            alert('Lệnh STOP đã được gửi!');
        } catch (e) { }
    };

    document.querySelectorAll('.q-action').forEach(btn => {
        btn.onclick = async () => {
            const cmd = btn.dataset.cmd;
            try {
                await authenticatedFetch('/api/chat/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: cmd })
                });
                updateChatContent();
            } catch (e) { }
        };
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

        const sessionsCount = document.getElementById('active-sessions-count');
        if (sessionsCount) sessionsCount.innerText = currentData.monitor.filter(m => m.connected).length;

        const tunnelArea = document.getElementById('tunnel-area');
        const urlInput = document.getElementById('public-url-input');
        const passInput = document.getElementById('tunnel-pass-input');

        if (tunnelArea && urlInput && passInput) {
            if (currentData.publicUrl) {
                tunnelArea.style.display = 'flex';
                urlInput.value = currentData.publicUrl;
                passInput.value = currentData.tunnelPassword || 'Đang lấy...';
            } else {
                tunnelArea.style.display = 'none';
            }
        }

        const accList = document.getElementById('account-list');
        if (accList) {
            accList.innerHTML = currentData.accounts.map(acc => `
                <div class="acc-card ${acc.isActive ? 'active' : ''}" onclick="switchAccount('${acc.id}')">
                    <div class="acc-info">
                        <span class="name">${acc.name}</span>
                        <span class="badge ${acc.isActive ? 'active' : ''}">${acc.isActive ? 'ĐANG DÙNG' : 'SẴN SÀNG'}</span>
                    </div>
                    <div class="quota-mini">
                        ${acc.quotas.length > 0 ? (() => {
                    // Khử trùng lặp theo displayName để đảm bảo UI sạch
                    const seen = new Set();
                    return acc.quotas
                        .filter(q => {
                            const duplicate = seen.has(q.displayName);
                            seen.add(q.displayName);
                            return !duplicate;
                        })
                        .map(q => {
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
                        }).join('');
                })() : '<div class="q-label-row">Không có dữ liệu quota</div>'}
                    </div>
                </div>
            `).join('');
        }

        const activeAcc = currentData.accounts.find(a => a.isActive);
        const healthPct = document.getElementById('quota-health-pct');
        if (healthPct) {
            if (activeAcc && activeAcc.quotas.length > 0) {
                const avg = Math.round(activeAcc.quotas.reduce((acc, curr) => acc + curr.percent, 0) / activeAcc.quotas.length);
                healthPct.innerText = avg + '%';
            } else {
                healthPct.innerText = '--%';
            }
        }

        const monList = document.getElementById('monitor-list');
        if (monList) {
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
        }

        const chart = document.getElementById('analytics-chart');
        if (chart && currentData.analytics && currentData.analytics.length > 0) {
            const max = Math.max(...currentData.analytics.map(a => a.tokens), 1);
            chart.innerHTML = currentData.analytics.map(a => {
                const h = (a.tokens / max) * 100;
                return `<div class="c-bar" style="height: ${Math.max(h, 5)}%"></div>`;
            }).join('');
        }

        const logCont = document.querySelector('.log-container');
        if (logCont) {
            logCont.innerHTML = (currentData.logs || []).map(log => `
                <div class="log-item">
                    <span class="time">${new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span>${log.message}</span>
                </div>
            `).join('');
        }
    }

    function stopLiveView() {
        if (streamInterval) clearInterval(streamInterval);
        streamInterval = null;
        activeTargetId = null;
    }

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
