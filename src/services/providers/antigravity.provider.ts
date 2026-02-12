import axios from 'axios';
import * as https from 'https';
import { promisify } from 'util';
import { exec } from 'child_process';
import { IAiProvider } from '../../interfaces/ai-provider.interface';
import { Account } from '../../interfaces/account.interface';
import { ModelQuota } from '../../interfaces/quota.interface';
import { ProtobufDecoder } from '../../api/protobuf/decoder';
import { TARGET_MODELS, MODEL_METADATA } from '../../config/models.config';

const execAsync = promisify(exec);

export class AntigravityProvider implements IAiProvider {
    private readonly BASE_URL = "https://daily-cloudcode-pa.sandbox.googleapis.com";
    private readonly TOKEN_URL = "https://oauth2.googleapis.com/token";
    private readonly CLIENT_ID = "1071006060591-tmhssin2h21lcre235vtolojh4g403ep.apps.googleusercontent.com";
    private readonly CLIENT_SECRET = "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";
    
    private localConnection: { port: number, token: string } | null = null;

    public async getQuota(account: Account): Promise<ModelQuota[]> {
        if (!account.data || !account.data.raw) {
            return this.getMockQuotas();
        }

        const session = ProtobufDecoder.decode(account.data.raw);
        if (!session || !session.auth) return [];

        let accessToken = session.auth.access_token;
        const idToken = session.auth.id_token;

        try {
            let projectId = await this.fetchProjectId(accessToken);
            if (!projectId) {
                accessToken = await this.refreshAccessToken(idToken);
                if (accessToken) {
                    projectId = await this.fetchProjectId(accessToken);
                }
            }

            if (!projectId || !accessToken) return [];

            if (projectId === "local_fallback" && this.localConnection) {
                return await this.fetchLocalQuota(this.localConnection.port, this.localConnection.token);
            }

            const response = await axios.post(
                `${this.BASE_URL}/v1internal:fetchAvailableModels`,
                { project: projectId },
                {
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                        "User-Agent": "antigravity/windows/amd64",
                    },
                    timeout: 10000
                }
            );

            const rawModels = response.data.models || {};
            const result: ModelQuota[] = [];

            for (const [key, displayName] of Object.entries(TARGET_MODELS)) {
                const modelInfo = rawModels[key];
                if (modelInfo && modelInfo.quotaInfo) {
                    const qi = modelInfo.quotaInfo;
                    const fraction = typeof qi.remainingFraction === 'number' ? qi.remainingFraction : 0;
                    const resetTimeRaw = qi.resetTime || "";
                    const remainingPercent = Math.floor(fraction * 100);
                    const meta = MODEL_METADATA[key];

                    result.push({
                        modelId: key,
                        displayName: displayName,
                        used: 100 - remainingPercent,
                        limit: 100,
                        percent: remainingPercent,
                        resetTime: this.formatResetTime(resetTimeRaw),
                        resetTimeRaw: resetTimeRaw ? new Date(resetTimeRaw).getTime() : undefined,
                        poolId: meta?.poolId,
                        capabilities: meta?.capabilities
                    });
                }
            }
            return result;
        } catch (e) {
            return [];
        }
    }

    private async refreshAccessToken(idToken: string): Promise<string | null> {
        try {
            const response = await axios.post(this.TOKEN_URL, {
                client_id: this.CLIENT_ID,
                client_secret: this.CLIENT_SECRET,
                refresh_token: idToken,
                grant_type: "refresh_token",
            }, { timeout: 5000 });
            return response.data.access_token || null;
        } catch (e) {
            return null;
        }
    }

    private async fetchProjectId(accessToken: string): Promise<string | null> {
        try {
            const response = await axios.post(
                `${this.BASE_URL}/v1internal:loadCodeAssist`,
                { metadata: { ideType: "ANTIGRAVITY" } },
                {
                    headers: {
                        "Authorization": `Bearer ${accessToken}`,
                        "Content-Type": "application/json",
                        "User-Agent": "antigravity/windows/amd64",
                    },
                    timeout: 5000
                }
            );
            return response.data.cloudaicompanionProject || response.data.project || response.data.projectId || null;
        } catch (e) {
            const local = await this.findLocalAntigravity();
            if (local) {
                this.localConnection = local;
                return "local_fallback";
            }
            return null;
        }
    }

    private async findLocalAntigravity(): Promise<{ port: number, token: string } | null> {
        if (this.localConnection) return this.localConnection;
        try {
            const command = `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name LIKE '%Antigravity%' OR Name LIKE '%Cursor%'\\" | Select-Object ProcessId,CommandLine | ConvertTo-Json"`;
            const { stdout } = await execAsync(command, { timeout: 3000 });
            if (!stdout) return null;

            let processes = JSON.parse(stdout);
            if (!Array.isArray(processes)) processes = [processes];

            for (const proc of processes) {
                const cmdLine = proc.CommandLine || '';
                if (!cmdLine.includes('--app_data_dir antigravity')) continue;

                const tokenMatch = cmdLine.match(/--csrf_token[=\s]+([a-f0-9-]+)/i);
                if (!tokenMatch) continue;

                const token = tokenMatch[1];
                const pid = proc.ProcessId;

                const portCmd = `powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -OwningProcess ${pid} | Select-Object -ExpandProperty LocalPort"`;
                const { stdout: portOut } = await execAsync(portCmd, { timeout: 2000 });
                const ports = portOut.match(/\b\d+\b/g)?.map(Number) || [];

                for (const port of ports) {
                    const isApi = await this.testLocalApi(port, token);
                    if (isApi) return { port, token };
                }
            }
        } catch (e) {
            // Ignore errors when finding local process
        }
        return null;
    }

    private testLocalApi(port: number, token: string): Promise<boolean> {
        return new Promise((resolve) => {
            const req = https.request({
                hostname: '127.0.0.1', port, path: '/exa.language_server_pb.LanguageServerService/GetUserStatus',
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Codeium-Csrf-Token': token },
                timeout: 500, rejectUnauthorized: false
            }, (res) => resolve(res.statusCode === 200));
            req.on('error', () => resolve(false));
            req.write(JSON.stringify({ metadata: { ideName: 'antigravity' } }));
            req.end();
        });
    }

    private async fetchLocalQuota(port: number, token: string): Promise<ModelQuota[]> {
        return new Promise((resolve) => {
            const req = https.request({
                hostname: '127.0.0.1', port, path: '/exa.language_server_pb.LanguageServerService/GetUserStatus',
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Codeium-Csrf-Token': token },
                rejectUnauthorized: false, timeout: 2000
            }, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        const models: ModelQuota[] = [];
                        const configs = json.userStatus?.cascadeModelConfigData?.clientModelConfigs || [];
                        for (const c of configs) {
                            const p = Math.floor((c.quotaInfo?.remainingFraction || 0) * 100);
                            models.push({
                                modelId: c.modelOrAlias?.model || c.modelOrAlias || 'unknown',
                                displayName: c.label || 'Unknown',
                                used: 100 - p, limit: 100, percent: p,
                                resetTime: "Local Sync"
                            });
                        }
                        resolve(models);
                    } catch (e) { resolve([]); }
                });
            });
            req.on('error', () => resolve([]));
            req.write(JSON.stringify({ metadata: { ideName: 'antigravity' } }));
            req.end();
        });
    }

    private formatResetTime(iso: string): string {
        if (!iso) return "Unknown";
        try {
            const date = new Date(iso);
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + " " + date.toLocaleDateString('en-US');
        } catch (e) {
            return iso;
        }
    }

    private getMockQuotas(): ModelQuota[] {
        return [{ modelId: 'mock-1', displayName: 'Mock Gemini', used: 0, limit: 100, percent: 100, resetTime: "Never" }];
    }
}
