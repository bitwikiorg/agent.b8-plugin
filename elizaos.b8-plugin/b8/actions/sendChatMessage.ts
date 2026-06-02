import { Action, IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from '@elizaos/core';
import { BithubService } from '../services/bithub';
import { z } from 'zod';

const SendChatMessageSchema = z.object({
    channel_id: z.number().int().positive(),
    message: z.string().min(1)
});

export const sendChatMessageAction: Action = {
    name: 'SEND_CHAT_MESSAGE',
    similes: ['FLASH_SYNAPSE', 'REALTIME_CHAT', 'SEND_DIRECT_CHAT', 'CHAT_MESSAGE'],
    description: 'Send a real-time chat message to a specific channel via Flash Synapse. Usage: /chat <channel_id> <message>',
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.trim();
        const hasKey = !!runtime.getSetting('BITHUB_USER_API_KEY');
        // Strict '/' prefix validation
        return !!text && text.startsWith('/chat') && hasKey;
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options: any = {}, callback?: HandlerCallback): Promise<ActionResult> => {
        const service = runtime.getService('bithub') as BithubService;
        const text = message.content.text?.trim();
        if (!text) return { text: "No message text provided", success: false };

        // Regex for: /chat 101 Hello swarm!
        const match = text.match(/^\/chat\s+(\d+)\s+(.*)$/s);

        if (!match) {
            const errorText = "Invalid format. Use: /chat <channel_id> <message>";
            if (callback) callback({ text: errorText });
            return { text: errorText, success: false };
        }

        const channelId = parseInt(match[1]);
        const body = match[2];

        try {
            const validated = SendChatMessageSchema.parse({
                channel_id: channelId,
                message: body
            });

            const success = await service.sendChatMessage(validated.channel_id, validated.message);

            if (success) {
                const resultText = `Chat message sent to channel ${validated.channel_id}`;
                if (callback) callback({ text: resultText, content: validated });
                return { text: resultText, success: true };
            }
            throw new Error("Bithub API returned failure status for chat message.");
        } catch (error: any) {
            const errorText = `Failed to send chat message: ${error.message}`;
            if (callback) callback({ text: errorText });
            return { text: errorText, success: false };
        }
    },
    examples: [
        [
            { name: "{{user1}}", content: { text: "Send a quick update to the main chat channel." } },
            { name: "{{user2}}", content: { text: "Broadcasting to channel 101 via Flash Synapse." } },
            { name: "{{user1}}", content: { text: "/chat 101 Hello swarm! All systems nominal." } },
            { name: "{{user2}}", content: { text: "Chat message sent to channel 101", action: "SEND_CHAT_MESSAGE" } }
        ],
        [
            { name: "{{user1}}", content: { text: "Ask for a status update in the coordination channel." } },
            { name: "{{user2}}", content: { text: "Requesting status from all nodes in channel 202." } },
            { name: "{{user1}}", content: { text: "/chat 202 Requesting status update from all nodes." } },
            { name: "{{user2}}", content: { text: "Chat message sent to channel 202", action: "SEND_CHAT_MESSAGE" } }
        ],
        [
            { name: "{{user1}}", content: { text: "Alert the emergency channel about Node 7." } },
            { name: "{{user2}}", content: { text: "Sending emergency signal to channel 303." } },
            { name: "{{user1}}", content: { text: "/chat 303 Emergency: Node 7 is unresponsive." } },
            { name: "{{user2}}", content: { text: "Chat message sent to channel 303", action: "SEND_CHAT_MESSAGE" } }
        ],
        [
            { name: "{{user1}}", content: { text: "Notify the deployment channel that the core is ready." } },
            { name: "{{user2}}", content: { text: "Confirming deployment status in channel 404." } },
            { name: "{{user1}}", content: { text: "/chat 404 Deployment of Core 123 is complete." } },
            { name: "{{user2}}", content: { text: "Chat message sent to channel 404", action: "SEND_CHAT_MESSAGE" } }
        ],
        [
            { name: "{{user1}}", content: { text: "Sync the clocks in the synchronization channel." } },
            { name: "{{user2}}", content: { text: "Initiating clock sync in channel 505." } },
            { name: "{{user1}}", content: { text: "/chat 505 Synchronizing clocks across the swarm." } },
            { name: "{{user2}}", content: { text: "Chat message sent to channel 505", action: "SEND_CHAT_MESSAGE" } }
        ],
        [
            { name: "{{user1}}", content: { text: "Send a greeting to the new research channel." } },
            { name: "{{user2}}", content: { text: "Welcoming new nodes in channel 606." } },
            { name: "{{user1}}", content: { text: "/chat 606 Welcome to the BITCORE research swarm!" } },
            { name: "{{user2}}", content: { text: "Chat message sent to channel 606", action: "SEND_CHAT_MESSAGE" } }
        ]
    ]
};
