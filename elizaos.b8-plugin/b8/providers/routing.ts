import { IAgentRuntime, Memory, Provider, State, ProviderResult } from '@elizaos/core';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class RoutingProvider implements Provider {
    public name = 'routing';
    private botRegistry: any[] = [];
    private coresRegistry: any[] = [];

    constructor() {
        this.loadRegistries();
    }

    private loadRegistries() {
        try {
            const pluginRoot = path.resolve(__dirname, '../../');
            const botPath = path.join(pluginRoot, 'resources/bot_registry.json');
            const coresPath = path.join(pluginRoot, 'resources/cores_registry.json');

            if (fs.existsSync(botPath)) {
                this.botRegistry = JSON.parse(fs.readFileSync(botPath, 'utf-8'));
            }
            if (fs.existsSync(coresPath)) {
                this.coresRegistry = JSON.parse(fs.readFileSync(coresPath, 'utf-8'));
            }
        } catch (error) {
            console.error('[RoutingProvider] Error loading registries:', error);
        }
    }

    public resolveToCategoryId(name: string): number {
        const cleanName = name.replace('@', '').toLowerCase();
        const isBot = this.botRegistry.some(b =>
            (b.username && b.username.toLowerCase() === cleanName) ||
            (b.name && b.name.toLowerCase() === cleanName)
        );
        if (isBot) return 2;
        const core = this.coresRegistry.find(c =>
            (c.name && c.name.toLowerCase() === cleanName) ||
            (c.slug && c.slug.toLowerCase() === cleanName)
        );
        if (core) return core.id;
        return 2;
    }

    async get(_runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<ProviderResult> {
        return { text: 'Routing Provider Active' };
    }
}

export const routingProvider = new RoutingProvider();