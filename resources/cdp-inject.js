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
            if (rect.width < 2 || rect.height < 2) return false;

            // 2. Kiểm tra visibility/opacity
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            if (parseFloat(style.opacity) < 0.1) return false;

            // 3. Kiểm tra xem có nằm trong vùng bị ẩn (ví dụ tab không active)
            let parent = el.parentElement;
            while (parent) {
                const pStyle = window.getComputedStyle(parent);
                if (pStyle.display === 'none' || parent.getAttribute('aria-hidden') === 'true') {
                    return false;
                }
                if (parent.classList.contains('hidden') && !parent.classList.contains('monaco-search-container')) return false;
                parent = parent.parentElement;
            }

            // 4. Kiểm tra vị trí (nằm trong hoặc gần viewport)
            // Nới rộng biên lên 100px
            const buffer = 100;
            if (rect.bottom < -buffer || rect.top > window.innerHeight + buffer ||
                rect.right < -buffer || rect.left > window.innerWidth + buffer) {
                return false;
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
            '.pane-body',
            '[id*="chat"]',
            '[class*="chat"]',
            '[class*="ai-"]',
            '[class*="agent"]',
            '.monaco-dialog-box', // Đưa thêm box thoại vào nếu nó chứa từ khóa accept
            'body' // Thêm body làm fallback cuối cùng nếu không tìm thấy container đặc thù
        ];

        // Hàm đệ quy tìm tất cả các shadow roots
        const getAllRoots = (root) => {
            let all = [root];
            const children = root.querySelectorAll('*');
            for (let i = 0; i < children.length; i++) {
                if (children[i].shadowRoot) {
                    all = all.concat(getAllRoots(children[i].shadowRoot));
                }
            }
            return all;
        };

        let roots = [document];
        try {
            roots = getAllRoots(document);
        } catch (e) { }

        const buttonSelectors = ['button', '.monaco-button', '.bg-ide-button-background', '[role="button"]', '.action-label', 'a.button'];

        for (const root of roots) {
            for (const agentSel of agentSelectors) {
                // Nếu agentSel là body hoặc container lớn, ta tìm nút bên trong
                const containers = (agentSel === 'body') ? [root] : root.querySelectorAll(agentSel);
                if (!containers || containers.length === 0) continue;

                for (const container of containers) {
                    for (const btnSel of buttonSelectors) {
                        const els = (container === root && root.querySelectorAll) ? root.querySelectorAll(btnSel) : container.querySelectorAll(btnSel);
                        if (!els) continue;

                        for (let i = 0; i < els.length; i++) {
                            const el = els[i];
                            if (isActionable(el)) {
                                state.buttonCache.set(el, Date.now());
                                console.log("[Antigravity Agent] Auto-Accepting:", el.innerText || el.getAttribute('aria-label'));

                                if (typeof el.click === 'function') {
                                    el.click();
                                }
                                // Giả lập chuỗi sự kiện đầy đủ để kích hoạt các framework như React/Vue
                                const opts = { view: window, bubbles: true, cancelable: true };
                                el.dispatchEvent(new MouseEvent('mousedown', opts));
                                el.dispatchEvent(new MouseEvent('mouseup', opts));
                                el.dispatchEvent(new MouseEvent('click', opts));
                                return;
                            }
                        }
                    }
                }
            }
        }
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
