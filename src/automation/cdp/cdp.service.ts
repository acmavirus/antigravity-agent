// Copyright by AcmaTvirus
import * as vscode from 'vscode';
import * as http from 'http';
import WebSocket from 'ws';

const PORTS_TO_SCAN = [
    9000, 9001, 9002, 9003, 9004, 9005, // AI IDEs (Cursor/Antigravity)
    9222, 9223, 9224, 9225,             // Standard Chrome/VSCode
    13337,                              // Cursor specific
    60345                               // Random high ports
];

interface CdpPage {
    id: string;
    title: string;
    type: string;
    webSocketDebuggerUrl?: string;
}

interface CdpConnection {
    ws: WebSocket;
    url: string;
}

export class CdpService {
    private connections: Map<string, CdpConnection> = new Map();
    private msgId: number = 1;
    private isEnabled: boolean = false;
    private pollTimer: NodeJS.Timeout | null = null;

    constructor(private context: vscode.ExtensionContext) {
        // Constructor intentional empty
    }

    public async start() {
        if (this.isEnabled) {
            return;
        }
        this.isEnabled = true;
        console.log('[CDP] Starting Intelligent Engine...');

        await this.scanAndConnect();

        // Scan every 45 seconds - Very low overhead
        this.pollTimer = setInterval(async () => {
            if (!this.isEnabled) {
                return;
            }
            await this.scanAndConnect();
        }, 45000);
    }

    public async stop() {
        this.isEnabled = false;
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }

        for (const [id, conn] of this.connections) { // eslint-disable-line @typescript-eslint/no-unused-vars
            try {
                conn.ws.close();
            } catch (e) {
                // Ignore close errors
            }
        }
        this.connections.clear();
    }

    private async scanAndConnect() {
        for (const port of PORTS_TO_SCAN) {
            try {
                const pages = await this.getPages(port);
                for (const page of pages) {
                    if (!page.webSocketDebuggerUrl) {
                        continue;
                    }

                    const id = `${port}:${page.id}`;
                    if (!this.connections.has(id)) {
                        await this.connect(id, page.webSocketDebuggerUrl);
                    }
                }
            } catch (e) {
                // Ignore connection errors during scan
            }
        }
    }

    private async getPages(port: number): Promise<CdpPage[]> {
        return new Promise((resolve) => {
            try {
                const req = http.get({
                    hostname: '127.0.0.1',
                    port: port,
                    path: '/json/list',
                    timeout: 400 // Fast timeout
                }, (res) => {
                    let data = '';
                    res.on('data', (chunk) => data += chunk);
                    res.on('end', () => {
                        try {
                            const pages = JSON.parse(data) as CdpPage[];
                            resolve(pages.filter(p => p.type === 'page' || p.type === 'webview' || p.type === 'iframe'));
                        } catch (e) {
                            resolve([]);
                        }
                    });
                });

                req.on('error', () => resolve([]));
                req.on('timeout', () => {
                    req.destroy();
                    resolve([]);
                });
            } catch (e) {
                resolve([]);
            }
        });
    }

    private connect(id: string, url: string): Promise<boolean> {
        return new Promise((resolve) => {
            try {
                const ws = new WebSocket(url);

                const timeout = setTimeout(() => {
                    if (ws.readyState === WebSocket.CONNECTING) {
                        try { ws.terminate(); } catch (e) { /* ignore */ }
                        resolve(false);
                    }
                }, 2000);

                ws.on('open', () => {
                    clearTimeout(timeout);
                    this.connections.set(id, { ws, url });
                    console.log(`[CDP] Connected to ${id}`);
                    resolve(true);
                });

                ws.on('error', () => {
                    clearTimeout(timeout);
                    resolve(false);
                });

                ws.on('close', () => {
                    this.connections.delete(id);
                });
            } catch (e) {
                resolve(false);
            }
        });
    }

    public evaluate(id: string, expression: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
        const conn = this.connections.get(id);
        if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
            return Promise.reject('WS unavailable');
        }

        return new Promise((resolve, reject) => {
            const msgId = this.msgId++;
            const payload = {
                id: msgId,
                method: 'Runtime.evaluate',
                params: {
                    expression: expression,
                    userGesture: true,
                    awaitPromise: true,
                    returnByValue: true
                }
            };

            const timeout = setTimeout(() => {
                conn.ws.off('message', onMessage);
                reject(new Error('Timeout'));
            }, 6000);

            const onMessage = (data: WebSocket.RawData) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.id === msgId) {
                        clearTimeout(timeout);
                        conn.ws.off('message', onMessage);
                        resolve(response.result);
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            };

            conn.ws.on('message', onMessage);
            conn.ws.send(JSON.stringify(payload));
        });
    }

    public async isDebuggingEnabled(): Promise<boolean> {
        for (const port of PORTS_TO_SCAN) {
            const pages = await this.getPages(port);
            if (pages.length > 0) {
                return true;
            }
        }
        return false;
    }

    public async dispatchKey(id: string, key: string, code: string, modifiers: number = 0) {
        try {
            await this.sendCommand(id, 'Input.dispatchKeyEvent', {
                type: 'keyDown',
                key: key,
                code: code,
                windowsVirtualKeyCode: key === 'Enter' ? 13 : undefined,
                modifiers: modifiers
            });
            await this.sendCommand(id, 'Input.dispatchKeyEvent', {
                type: 'keyUp',
                key: key,
                code: code,
                windowsVirtualKeyCode: key === 'Enter' ? 13 : undefined,
                modifiers: modifiers
            });
        } catch (e) {
            // Ignore dispatch errors
        }
    }

    public async insertText(id: string, text: string) {
        try {
            await this.sendCommand(id, 'Input.insertText', { text });
        } catch (e) {
            // Ignore insert errors
        }
    }

    public async captureScreenshot(id: string): Promise<string | null> {
        try {
            const result = await this.sendCommand(id, 'Page.captureScreenshot', {
                format: 'jpeg',
                quality: 50
            });
            return result.data; // Base64 string
        } catch (e) { return null; }
    }

    public async scrapeChat(id: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
        try {
            // Script để lấy chat từ DOM của Cursor/Antigravity
            const script = `
                (() => {
                    const messages = Array.from(document.querySelectorAll('.chat-line, .message-container'));
                    return messages.map(m => m.innerText).slice(-5);
                })()
            `;
            const result = await this.evaluate(id, script);
            return result.value || [];
        } catch (e) { return []; }
    }

    public async getWorkspacePath(id: string): Promise<string | null> {
        try {
            const result = await this.evaluate(id, 'window.vscode?.workspace?.workspaceFolders?.[0]?.uri?.path || "Unknown"');
            return result.value;
        } catch (e) { return null; }
    }

    public async insertAndSubmit(id: string, text: string) {
        try {
            await this.insertText(id, text);
            await new Promise(r => setTimeout(r, 100));
            await this.dispatchKey(id, 'Enter', 'Enter');
        } catch (e) {
            // Ignore errors
        }
    }

    public async getChatSnapshot(id: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
        try {
            const script = `
                (() => {
                    const findMessages = () => {
                        // Thử nhiều selector phổ biến cho vùng chat AI
                        const selectors = ['.chat-line', '.message-container', '.chat-message', '[class*="message"]'];
                        for (const sel of selectors) {
                            const found = document.querySelectorAll(sel);
                            if (found.length > 5) return Array.from(found);
                        }
                        return Array.from(document.querySelectorAll('div')).filter(d => 
                            d.innerText.length > 20 && (d.innerText.includes('Thought') || d.innerText.includes('Analyzed'))
                        );
                    };

                    const rawMessages = findMessages();
                    const messages = [];
                    
                    rawMessages.forEach(m => {
                        const text = m.innerText.trim();
                        if (!text) return;

                        if (text.startsWith('Thought for') || text.includes('Thinking...')) {
                            // Cố gắng lấy nội dung suy nghĩ (thường nằm trong div con hoặc kế tiếp)
                            const content = m.nextElementSibling?.innerText || m.querySelector('.thought-content')?.innerText || 'AI is reasoning...';
                            messages.push({ 
                                type: 'thought', 
                                duration: text.split('for').pop()?.trim() || '<1s',
                                content: content.slice(0, 500) 
                            });
                        } else if (text.includes('Analyzed') || text.includes('Edited') || text.includes('README.md')) {
                            messages.push({ 
                                type: 'action', 
                                action: text.includes('Edited') ? 'Edited' : 'Analyzed',
                                file: text.match(/[\\w-]+\\.[md|ts|js|py]+/)?.[0] || 'file.ts',
                                diff: text.match(/[+-]\\d+/g)?.join(' ') || ''
                            });
                        } else {
                            // Phân biệt User và AI (Heuristic)
                            const isUser = m.classList.contains('user-message') || m.style.alignSelf === 'flex-end';
                            messages.push({ type: isUser ? 'user' : 'text', text });
                        }
                    });

                    // Lấy thông tin Mode/Model thực tế từ Header của VS Code (Nửa heuristic)
                    const mode = document.querySelector('.antigravity-status-bar')?.innerText || 'Planning';
                    const model = document.querySelector('.model-name-selector')?.innerText || 'Gemini 2.0 Pro';
                    
                    return { messages: messages.slice(-50), mode, model, nodes: 537, mem: '364KB' };
                })()
            `;
            const result = await this.evaluate(id, script);
            return result.value || { messages: [] };
        } catch (e) {
            return { messages: [] };
        }
    }

    public async stopGeneration(id: string) {
        try {
            const script = `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
                    const stopBtn = buttons.find(b => {
                        const txt = b.innerText.toLowerCase();
                        return txt.includes('stop') || b.querySelector('.codicon-stop');
                    });
                    if (stopBtn) {
                        stopBtn.click();
                        return true;
                    }
                    return false;
                })()
            `;
            await this.evaluate(id, script);
        } catch (e) {
            // Ignore errors
        }
    }

    public async acceptSuggestion(id: string) {
        try {
            const script = `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button, .button, [role="button"]'));
                    const target = buttons.find(b => {
                        const txt = b.innerText.toLowerCase();
                        return txt.includes('accept') || txt.includes('run') || txt.includes('approve') || txt.includes('apply');
                    });
                    if (target) {
                        target.click();
                        return true;
                    }
                    return false;
                })()
            `;
            await this.evaluate(id, script);
        } catch (e) {
            // Ignore errors
        }
    }

    private async sendCommand(id: string, method: string, params: any): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
        const conn = this.connections.get(id);
        if (!conn || conn.ws.readyState !== WebSocket.OPEN) {
            return Promise.reject('WS unavailable');
        }

        return new Promise((resolve, reject) => {
            const msgId = this.msgId++;
            const payload = { id: msgId, method, params };

            const onMessage = (data: WebSocket.RawData) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.id === msgId) {
                        conn.ws.off('message', onMessage);
                        resolve(response.result);
                    }
                } catch (e) {
                    // Ignore parse errors
                }
            };

            conn.ws.on('message', onMessage);
            conn.ws.send(JSON.stringify(payload));
            setTimeout(() => {
                conn.ws.off('message', onMessage);
                reject(new Error('Timeout'));
            }, 5000);
        });
    }

    public getConnectionInfo() {
        const info = [];
        for (const [id, conn] of this.connections) {
            info.push({
                id,
                url: conn.url,
                connected: conn.ws?.readyState === WebSocket.OPEN
            });
        }
        return info;
    }
}
