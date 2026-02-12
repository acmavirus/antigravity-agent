// Copyright by AcmaTvirus
import localtunnel from 'localtunnel';
import axios from 'axios';
import { Logger, LogLevel } from '../../utils/logger';

export class TunnelManager {
    private tunnel: localtunnel.Tunnel | null = null;
    public publicUrl: string | null = null;
    public tunnelPassword: string | null = null;

    constructor(private logService: Logger) {}

    public async start(port: number, pin: string) {
        try {
            // Lấy IP công cộng (Tunnel Password) từ nhiều nguồn ổn định
            const providers = [
                'https://api.ipify.org',
                'https://ifconfig.me/ip',
                'https://loca.lt/mytunnelpassword'
            ];
            for (const url of providers) {
                try {
                    const res = await axios.get(url, { timeout: 3000 });
                    const ip = res.data.toString().trim();
                    // Validate IP IPv4 format
                    if (/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip)) {
                        this.tunnelPassword = ip;
                        this.logService.info(`Public IP identified: ${ip} (from ${new URL(url).hostname})`, 'TunnelManager');
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            this.tunnel = await localtunnel({ port });
            this.publicUrl = this.tunnel.url;
            this.logService.success(`URL: ${this.publicUrl} | PIN: ${pin}`, 'TunnelManager');
        } catch (e: any) {
            this.logService.error(`Tunnel Error: ${e.message}`, 'TunnelManager');
        }
    }

    public stop() {
        if (this.tunnel) {
            this.tunnel.close();
            this.tunnel = null;
        }
    }
}
