// Copyright by AcmaTvirus
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

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
    ws: any;
    injected: boolean;
    lastConfigHash?: string;
}

export class CdpService {
    private connections: Map<string, CdpConnection> = new Map();
    private msgId: number = 1;
    private isEnabled: boolean = false;
    private pollTimer: NodeJS.Timeout | null = null;

    constructor(private context: vscode.ExtensionContext) { }

    public async start() {
        if (this.isEnabled) return;
        this.isEnabled = true;
        console.log('[CDP] Starting Intelligent Engine...');

        await this.scanAndConnect();

        // Scan every 45 seconds - Very low overhead
        this.pollTimer = setInterval(async () => {
            if (!this.isEnabled) return;
            await this.scanAndConnect();
        }, 45000);
    }

    public async stop() {
        this.isEnabled = false;
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }

        for (const [id, conn] of this.connections) {
            try {
                await this.evaluate(id, 'if(window.__autoAcceptStop) window.__autoAcceptStop()');
                conn.ws.close();
            } catch (e) { }
        }
        this.connections.clear();
    }

    private async scanAndConnect() {
        for (const port of PORTS_TO_SCAN) {
            try {
                const pages = await this.getPages(port);
                for (const page of pages) {
                    if (!page.webSocketDebuggerUrl) continue;

                    const id = `${port}:${page.id}`;
                    if (!this.connections.has(id)) {
                        await this.connect(id, page.webSocketDebuggerUrl);
                    }

                    await this.injectScript(id);
                }
            } catch (e) { }
        }
    }

    private async getPages(port: number): Promise<CdpPage[]> {
        return new Promise((resolve) => {
            try {
                const http = require('http');
                const req = http.get({
                    hostname: '127.0.0.1',
                    port: port,
                    path: '/json/list',
                    timeout: 400 // Fast timeout
                }, (res: any) => {
                    let data = '';
                    res.on('data', (chunk: any) => data += chunk);
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
                const WebSocket = require('ws');
                const ws = new WebSocket(url);

                const timeout = setTimeout(() => {
                    if (ws.readyState === WebSocket.CONNECTING) {
                        try { ws.terminate(); } catch (e) { }
                        resolve(false);
                    }
                }, 2000);

                ws.on('open', () => {
                    clearTimeout(timeout);
                    this.connections.set(id, { ws, injected: false });
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

    private async injectScript(id: string) {
        const conn = this.connections.get(id);
        if (!conn) return;

        try {
            if (!conn.injected) {
                const scriptPath = this.context.asAbsolutePath(path.join('resources', 'cdp-inject.js'));
                if (fs.existsSync(scriptPath)) {
                    const scriptContent = fs.readFileSync(scriptPath, 'utf8');
                    await this.evaluate(id, scriptContent);
                    conn.injected = true;
                }
            }

            const config = { mode: 'passive' };
            const configStr = JSON.stringify(config);

            if (conn.lastConfigHash !== configStr) {
                await this.evaluate(id, `if(window.__autoAcceptStart) window.__autoAcceptStart(${configStr})`);
                conn.lastConfigHash = configStr;
            }

        } catch (e) {
            conn.injected = false;
        }
    }

    public evaluate(id: string, expression: string): Promise<any> {
        const conn = this.connections.get(id);
        if (!conn || conn.ws.readyState !== 1) return Promise.reject('WS unavailable');

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

            const onMessage = (data: any) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.id === msgId) {
                        clearTimeout(timeout);
                        conn.ws.off('message', onMessage);
                        resolve(response.result);
                    }
                } catch (e) { }
            };

            conn.ws.on('message', onMessage);
            conn.ws.send(JSON.stringify(payload));
        });
    }

    public async isDebuggingEnabled(): Promise<boolean> {
        for (const port of PORTS_TO_SCAN) {
            const pages = await this.getPages(port);
            if (pages.length > 0) return true;
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
        } catch (e) { }
    }

    public async insertText(id: string, text: string) {
        try {
            await this.sendCommand(id, 'Input.insertText', { text });
        } catch (e) { }
    }

    private async sendCommand(id: string, method: string, params: any): Promise<any> {
        const conn = this.connections.get(id);
        if (!conn || conn.ws.readyState !== 1) return Promise.reject('WS unavailable');

        return new Promise((resolve, reject) => {
            const msgId = this.msgId++;
            const payload = { id: msgId, method, params };

            const onMessage = (data: any) => {
                try {
                    const response = JSON.parse(data.toString());
                    if (response.id === msgId) {
                        conn.ws.off('message', onMessage);
                        resolve(response.result);
                    }
                } catch (e) { }
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
                injected: conn.injected,
                connected: conn.ws.readyState === 1
            });
        }
        return info;
    }
}
