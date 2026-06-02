import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const coreStateProvider = {
    name: 'cores',
    get: async (_runtime, _message, _state) => {
        const registryPath = path.resolve(__dirname, '../../resources/cores_registry.json');
        try {
            const data = await fs.readFile(registryPath, 'utf-8');
            const registry = JSON.parse(data);
            let output = 'Available Cores (Workflows):\n';
            registry.forEach((core) => {
                output += `- ${core.name} (ID: ${core.id}) - ${core.description || 'No description'}\n`;
            });
            return { text: output };
        }
        catch (e) {
            return { text: 'No cores available in registry.' };
        }
    }
};
