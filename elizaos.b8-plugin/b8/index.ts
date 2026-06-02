import { Plugin } from '@elizaos/core';
import { sendMessageAction } from './actions/sendMessage';
import { deployCoreAction } from './actions/deployCore';
import { sendChatMessageAction } from './actions/sendChatMessage';
import { routingProvider } from './providers/routing';
import { bithubJanitorEvaluator } from './evaluators/janitor';
import { BithubService } from './services/bithub';

export const bithubPlugin: Plugin = {
    name: 'elizaos.b8-plugin',
    description: 'BITCORE Neural Net Link for ElizaOS',
    actions: [sendMessageAction, deployCoreAction, sendChatMessageAction],
    providers: [routingProvider], // Removed swarmRegistryProvider and coreStateProvider to prevent context bloat
    evaluators: [bithubJanitorEvaluator],
    services: [BithubService]
};

export default bithubPlugin;
