// Copyright by AcmaTvirus
document.addEventListener('DOMContentLoaded', () => {
    const vscode = acquireVsCodeApi();

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'update':
                renderAccounts(message.accounts);
                break;
        }
    });

    const refreshBtn = document.getElementById('refreshBtn');
    const addBtn = document.getElementById('addBtn');
    const autoImportBtn = document.getElementById('autoImportBtn');

    // Lưu trữ trạng thái thu gọn của các card
    let collapsedAccounts = new Set();

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
        }
    });

    function renderAccounts(accounts) {
        const container = document.getElementById('account-list');
        if (!container) return;

        if (accounts.length === 0) {
            container.innerHTML = '<div class="empty-state">Chưa có tài khoản nào. Nhấn "+" để thêm.</div>';
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
                `<span class="active-label"><i class="codicon codicon-check"></i> Đang dùng</span>` :
                `<button class="switch-btn" data-id="${acc.id}">Sử dụng</button>`;

            card.innerHTML = `
                <div class="card-header">
                    <div class="header-left">
                        <i class="codicon codicon-chevron-down toggle-icon"></i>
                        <span class="account-name">${acc.name}</span>
                    </div>
                    <div class="header-right">
                        ${acc.isActive ? '<span class="status-indicator"></span>' : ''}
                        <span class="status-badge ${statusClass}"></span>
                        <button class="delete-btn" data-id="${acc.id}" title="Xóa tài khoản"><i class="codicon codicon-close"></i></button>
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
            }).join('') : '<div class="meta">Chưa có dữ liệu hạn mức.</div>'}
                    </div>
                    <div class="card-footer">
                        ${switchButton}
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }
});
