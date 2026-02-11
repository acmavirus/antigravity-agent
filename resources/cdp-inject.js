/**
 * CDP AUTO-ACCEPT AGENT (V6 - NO FOCUS STEAL / STABLE)
 * Copyright by AcmaTvirus
 */
(function () {
    "use strict";
    if (typeof window === 'undefined' || window.__autoAcceptInitialized) return;
    window.__autoAcceptInitialized = true;

    const log = (msg) => {
        // Silent
    };

    const state = {
        isRunning: false,
        buttonCache: new Map(), // Element -> LastClickTime
    };

    /**
     * Kiểm tra xem một phần tử có thực sự hiển thị và thuộc về view đang active hay không.
     */
    const isActuallyVisible = (el) => {
        try {
            // 1. Kiểm tra kích thước cơ bản
            const rect = el.getBoundingClientRect();
            if (rect.width < 5 || rect.height < 5) return false;

            // 2. Kiểm tra visibility/opacity của chính nó và cha
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;

            // 3. Kiểm tra xem có nằm trong vùng bị ẩn (ví dụ tab không active)
            // Trong VS Code/Cursor, các tab không active thường nằm trong container có display: none hoặc aria-hidden=true
            let parent = el.parentElement;
            while (parent) {
                const pStyle = window.getComputedStyle(parent);
                if (pStyle.display === 'none' || parent.getAttribute('aria-hidden') === 'true') {
                    return false;
                }
                // Nếu thấy container của workbench chat mà không phải là view hiện tại
                if (parent.classList.contains('hidden')) return false;
                parent = parent.parentElement;
            }

            // 4. Kiểm tra vị trí (nằm trong viewport)
            if (rect.top < 0 || rect.left < 0 || rect.bottom > window.innerHeight || rect.right > window.innerWidth) {
                // Đôi khi các nút trong panel vẫn được tính, nhưng nếu nó quá xa viewport thì bỏ qua
                if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
            }

            return true;
        } catch (e) {
            return false;
        }
    };

    const isActionable = (el) => {
        if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;

        // Tránh click lại quá nhanh (throttle 3s)
        const lastClick = state.buttonCache.get(el) || 0;
        if (Date.now() - lastClick < 3000) return false;

        const text = (el.textContent || el.getAttribute('aria-label') || "").trim().toLowerCase();
        if (text.length === 0 || text.length > 40) return false;

        // Keywords CỰC KỲ KHẮT KHE
        // Loại bỏ "always" vì nó quá chung chung, dễ nhầm với "Always show..."
        const keywords = ['accept', 'run', 'apply', 'approve', 'confirm', 'allow', 'yes', 'ok', 'execute'];

        // Danh sách đen các từ khóa gây chuyển hướng hoặc không phải nút chấp nhận
        const rejects = [
            'deny', 'skip', 'cancel', 'close', 'refine', 'reject', 'settings', 'ignore',
            'new', 'chat', 'conversation', 'show', 'open', 'history', 'clear', 'delete'
        ];

        if (rejects.some(k => text.includes(k))) return false;
        if (!keywords.some(k => text.includes(k))) return false;

        // Kiểm tra xem có thuộc vùng cấm (Navigation, Toolbars, Sidebars)
        // Đây là những nơi click vào sẽ gây mất focus hoặc nhảy tab
        if (el.closest('.monaco-toolbar') ||
            el.closest('.monaco-menu-container') ||
            el.closest('.monaco-list') ||
            el.closest('.monaco-pane-view-header') ||
            el.closest('.activitybar')) return false;

        // Cuối cùng mới kiểm tra Visibility (tốn hiệu năng nhất)
        return isActuallyVisible(el);
    };

    const performScan = () => {
        if (!state.isRunning) return;

        // Không hành động nếu người dùng đang thực sự nhập liệu (Focus vào input)
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
            return;
        }

        // Danh sách các selector đặc trưng cho vùng Chat/Agent của VS Code và Cursor
        const agentSelectors = [
            '.chat-container',
            '.composer-container',
            '.interactive-container',
            '.ai-chat-view',
            '.pane-body', // Thường là nội dung của các Sidebar pane
            '[id*="chat"]',
            '[class*="chat"]'
        ];

        // Tìm tất cả các rễ (document + shadow roots của webviews)
        const roots = [document];
        const hosts = document.querySelectorAll('.webview.ready');
        hosts.forEach(h => { if (h.shadowRoot) roots.push(h.shadowRoot); });

        const buttonSelectors = ['button', '.monaco-button', '.bg-ide-button-background', '[role="button"]'];

        roots.forEach(root => {
            // Duyệt qua từng container của Agent
            agentSelectors.forEach(agentSel => {
                const containers = root.querySelectorAll(agentSel);
                containers.forEach(container => {
                    // Chỉ tìm nút bấm bên trong container này
                    buttonSelectors.forEach(btnSel => {
                        const els = container.querySelectorAll(btnSel);
                        for (let i = 0; i < els.length; i++) {
                            const el = els[i];
                            if (isActionable(el)) {
                                state.buttonCache.set(el, Date.now());
                                log("Auto-Accepting in Agent View: " + el.textContent);

                                if (typeof el.click === 'function') el.click();
                                el.dispatchEvent(new MouseEvent('click', { view: window, bubbles: true, cancelable: true }));
                                return; // Dừng quét sau khi tìm thấy 1 nút hợp lệ
                            }
                        }
                    });
                });
            });
        });
    };

    window.__autoAcceptStart = function (config) {
        if (state.isRunning) return;
        state.isRunning = true;

        const loop = () => {
            if (!state.isRunning) return;
            performScan();
            // Tần suất chậm lại để ổn định hơn (2 giây)
            setTimeout(loop, 2000);
        };
        loop();
    };

    window.__autoAcceptStop = function () {
        state.isRunning = false;
    };

})();
