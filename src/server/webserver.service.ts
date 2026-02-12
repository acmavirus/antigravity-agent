// Copyright by AcmaTvirus
import * as vscode from 'vscode';
import express from 'express';
import * as path from 'path';
import { Server } from 'http';
import localtunnel from 'localtunnel';
import axios from 'axios';
import { AccountService } from '../core/account.service';
import { QuotaService } from '../core/quota.service';
import { LogService, LogLevel } from '../core/log.service';
import { AnalyticsService } from '../core/analytics.service';
import { CdpService } from '../automation/cdp.service';

/**
 * Service quản lý Web Server để truy cập Dashboard từ điện thoại.
 */
export class WebServerService {
    private app: express.Application;
    private server: Server | null = null;
    private tunnel: localtunnel.Tunnel | null = null;
    private publicUrl: string | null = null;
    private tunnelPassword: string | null = null;
    private pin: string = '';
    private readonly PORT = 3001;

    constructor(
        private context: vscode.ExtensionContext,
        private accountService: AccountService,
        private quotaService: QuotaService,
        private logService: LogService,
        private analyticsService: AnalyticsService,
        private cdpService: CdpService
    ) {
        this.app = express();
        this.app.use(express.json());
        this.generatePin();
        this.setupRoutes();
    }

    private generatePin() {
        this.pin = Math.floor(100000 + Math.random() * 900000).toString();
    }

    private authMiddleware = (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const authHeader = req.headers.authorization;
        if (authHeader === `Bearer ${this.pin}`) {
            next();
        } else {
            res.status(401).json({ error: 'Unauthorized: Invalid PIN', needsAuth: true });
        }
    };

    private setupRoutes() {
        // Serve static files (No-Auth for assets)
        const staticPath = path.join(this.context.extensionPath, 'resources', 'mobile');
        this.app.use(express.static(staticPath));

        // Public Auth Status
        this.app.get('/api/auth/status', (req, res) => {
            res.json({ authEnabled: true });
        });

        // Login endpoint
        this.app.post('/api/auth/login', (req, res) => {
            const { pin } = req.body;
            if (pin === this.pin) {
                res.json({ success: true, token: this.pin });
            } else {
                res.status(401).json({ success: false, error: 'Invalid PIN' });
            }
        });

        // Protected API endpoints
        const api = express.Router();
        api.use(this.authMiddleware);

        api.get('/status', async (req, res) => {
            const activeEmail = await this.accountService.getActiveEmail();
            const accounts = this.accountService.getAccounts().map(acc => ({
                id: acc.id,
                name: acc.name,
                status: acc.status,
                isActive: acc.name === activeEmail,
                quotas: this.quotaService.getCachedQuotas(acc.id) || []
            }));

            const monitorInfo = [];
            const connections = this.cdpService.getConnectionInfo();
            for (const conn of connections) {
                const workspace = conn.connected ? await this.cdpService.getWorkspacePath(conn.id) : null;
                monitorInfo.push({ ...conn, workspace });
            }

            res.json({
                accounts,
                monitor: monitorInfo,
                publicUrl: this.publicUrl,
                tunnelPassword: this.tunnelPassword,
                logs: this.logService.getLogs().slice(-20),
                analytics: this.analyticsService.getUsageHistory(),
                timestamp: new Date().toISOString()
            });
        });

        api.get('/screenshot/:id', async (req, res) => {
            const base64 = await this.cdpService.captureScreenshot(req.params.id);
            if (base64) {
                const img = Buffer.from(base64, 'base64');
                res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Content-Length': img.length });
                res.end(img);
            } else {
                res.status(404).json({ error: 'Failed' });
            }
        });

        api.post('/inject', async (req, res) => {
            const { id, text } = req.body;
            if (id && text) {
                await this.cdpService.insertAndSubmit(id, text);
                res.json({ success: true });
            } else {
                res.status(400).json({ error: 'Missing data' });
            }
        });

        api.post('/accept', async (req, res) => {
            const { id } = req.body;
            if (id) {
                await this.cdpService.acceptSuggestion(id);
                const commands = ['antigravity.step.accept', 'antigravity.step.run', 'antigravity.accept'];
                for (const cmd of commands) {
                    try { await vscode.commands.executeCommand(cmd); } catch (e) { }
                }
                res.json({ success: true });
            } else {
                res.status(400).json({ error: 'Missing id' });
            }
        });

        api.post('/refresh', async (req, res) => {
            await this.quotaService.refreshAll(true);
            res.json({ success: true });
        });

        api.post('/switch/:id', async (req, res) => {
            await this.accountService.switchAccount(req.params.id);
            res.json({ success: true });
        });

        this.app.use('/api', api);
    }

    public async start() {
        if (this.server) return;
        try {
            this.server = this.app.listen(this.PORT, '0.0.0.0', async () => {
                const localUrl = `http://localhost:${this.PORT}`;
                console.log(`[WebServer] Mobile Dashboard running at ${localUrl} | PIN: ${this.pin}`);
                this.logService.addLog(LogLevel.Info, `Mobile Dashboard started | PIN: ${this.pin}`, 'WebServer');

                vscode.window.showInformationMessage(`🚀 Antigravity Mobile Server ON | PIN: ${this.pin}`, 'Copy PIN').then(val => {
                    if (val === 'Copy PIN') vscode.env.clipboard.writeText(this.pin);
                });

                try {
                    const res = await axios.get('https://loca.lt/mytunnelpassword');
                    this.tunnelPassword = res.data.trim();
                } catch (e) { }

                try {
                    this.tunnel = await localtunnel({ port: this.PORT });
                    this.publicUrl = this.tunnel.url;
                    this.logService.addLog(LogLevel.Success, `URL: ${this.publicUrl} | PIN: ${this.pin}`, 'WebServer');
                } catch (e: any) {
                    this.logService.addLog(LogLevel.Error, `Tunnel Error: ${e.message}`, 'WebServer');
                }
            });
        } catch (error: any) {
            console.error(`[WebServer] Failed to start: ${error.message}`);
        }
    }

    public stop() {
        if (this.tunnel) { this.tunnel.close(); this.tunnel = null; }
        if (this.server) { this.server.close(); this.server = null; }
    }
}
