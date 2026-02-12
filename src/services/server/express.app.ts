// Copyright by AcmaTvirus
import * as vscode from 'vscode';
import express from 'express';
import * as path from 'path';
import { AccountService } from '../account.service';
import { QuotaService } from '../quota.service';
import { Logger } from '../../utils/logger';
import { AnalyticsService } from '../analytics.service';
import { CdpService } from '../../automation/cdp/cdp.service';

export class ExpressApp {
    public app: express.Application;
    
    constructor(
        private context: vscode.ExtensionContext,
        private accountService: AccountService,
        private quotaService: QuotaService,
        private logService: Logger,
        private analyticsService: AnalyticsService,
        private cdpService: CdpService,
        private pin: string,
        private tunnelManager: any // Type any to avoid circular dependency or import issues for now
    ) {
        this.app = express();
        this.app.use(express.json());
        this.setupRoutes();
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
                publicUrl: this.tunnelManager.publicUrl,
                tunnelPassword: this.tunnelManager.tunnelPassword,
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
                    try { await vscode.commands.executeCommand(cmd); } catch (e) {
                        // Ignore command execution errors
                    }
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

        // Chat Agent API (New for Image 1 Style)
        api.get('/chat/status', async (req, res) => {
            const connections = this.cdpService.getConnectionInfo();
            const active = connections.find(c => c.connected);
            if (!active) {
                return res.json({ messages: [], mode: 'Planning', model: 'Gemini 3 Flash' });
            }
            const snapshot = await this.cdpService.getChatSnapshot(active.id);
            res.json(snapshot);
        });

        api.post('/chat/send', async (req, res) => {
            const { text } = req.body;
            const connections = this.cdpService.getConnectionInfo();
            const active = connections.find(c => c.connected);
            if (active && text) {
                await this.cdpService.insertAndSubmit(active.id, text);
                res.json({ success: true });
            } else {
                res.status(400).json({ error: 'No active connection or missing text' });
            }
        });

        api.post('/chat/stop', async (req, res) => {
            const connections = this.cdpService.getConnectionInfo();
            const active = connections.find(c => c.connected);
            if (active) {
                await this.cdpService.stopGeneration(active.id);
                // Also trigger VS Code command for fallback
                try { await vscode.commands.executeCommand('antigravity.step.stop'); } catch (e) {
                    // Ignore stop command error
                }
                res.json({ success: true });
            } else {
                res.status(400).json({ error: 'No active connection' });
            }
        });

        this.app.use('/api', api);
    }
}
