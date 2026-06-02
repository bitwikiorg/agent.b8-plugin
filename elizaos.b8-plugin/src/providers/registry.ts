import { IAgentRuntime, Memory, Provider, State, ProviderResult } from '@elizaos/core';
import * as fs from 'fs';
import * as path from 'path';

interface Bot {
    type: string;
    name: string;
    username: string;
    description: string;
    provider: string;
}

let botCache: Bot[] | null = null;
let lastFetch = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export const swarmRegistryProvider: Provider = {
    name: 'registry',
    get: async (runtime: IAgentRuntime, _message: Memory, _state?: State): Promise<ProviderResult> => {
        const now = Date.now();
        
        if (!botCache || (now - lastFetch) > CACHE_TTL) {
            try {
                const registryPath = path.join(process.cwd(), 'elizaos.b8-plugin', 'resources', 'bot_registry.json');
                if (fs.existsSync(registryPath)) {
                    const data = fs.readFileSync(registryPath, 'utf-8');
                    botCache = JSON.parse(data);
                    lastFetch = now;
                } else {
                    return { text: 'Bithub Registry: bot_registry.json not found.' };
                }
            } catch (e) {
                return { text: 'Bithub Registry: Failed to read local registry.' };
            }
        }

        if (!botCache || botCache.length === 0) {
            return { text: 'Bithub Registry: Empty.' };
        }

        let output = 'Available Swarm Agents (Local Cache):\n';
        botCache.forEach((bot: Bot) => {
            output += `- @${bot.username} (${bot.name}) [${bot.type.toUpperCase()}] - ${bot.description}\n`;
        });

        return { text: output };
    }
};
