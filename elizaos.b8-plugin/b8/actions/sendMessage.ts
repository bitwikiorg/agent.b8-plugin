import { Action, IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from '@elizaos/core';
import { BithubService } from '../services/bithub';
import { z } from 'zod';

const SendMessageSchema = z.object({
    recipients: z.array(z.string().regex(/^@?[\w\d_-]+$/)).min(1),
    title: z.string().min(1),
    raw: z.string().min(1),
});

export const sendMessageAction: Action = {
    name: 'SEND_SWARM_MESSAGE',
    similes: ['SEND_BITHUB_MESSAGE', 'MESSAGE_AGENT', 'PRIVATE_MESSAGE', 'DM_AGENT', 'ASK_SWARM'],
    description: 'Send a private message to one or more agents in the Bithub swarm and optionally wait for their response. Usage: /send <recipient> "<title>" <body> OR Ask @agent about <topic>',
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.trim();
        const hasKey = !!runtime.getSetting('BITHUB_USER_API_KEY');
        if (!text || !hasKey) return false;
        
        // Support both slash command and natural language
        return text.startsWith('/send') || text.toLowerCase().includes('ask @') || text.toLowerCase().includes('ask swarm');
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options: any = {}, callback?: HandlerCallback): Promise<ActionResult> => {
        const service = runtime.getService('bithub') as BithubService;
        const text = message.content.text?.trim();
        if (!text) return { text: "No message text provided", success: false };

        let recipient: string;
        let title: string;
        let body: string;
        let waitForResponse = false;

        // Check if natural language query (swarm behavior)
        const naturalMatch = text.match(/ask\s+(@?[\w\d_-]+)\s+(?:about\s+)?(.+)/i);
        if (naturalMatch) {
            recipient = naturalMatch[1];
            title = "Query from CORE-Align";
            body = naturalMatch[2];
            waitForResponse = true; // Always wait for natural language queries
        } else {
            // Regex for: /send @recipient "Title with spaces" Body starts here
            const match = text.match(/^\/send\s+(@?[\w\d_-]+)\s+(?:"([^"]+)"|(\S+))\s+(.*)$/s);
            
            if (!match) {
                const errorText = "Invalid format. Use: /send <recipient> \"<title>\" <body> OR ask @agent about <topic>";
                if (callback) callback({ text: errorText });
                return { text: errorText, success: false };
            }

            recipient = match[1];
            title = match[2] || match[3];
            body = match[4];
        }

        try {
            const validated = SendMessageSchema.parse({
                recipients: [recipient],
                title: title,
                raw: body
            });

            // Use new swarm-aware method
            const result = await service.sendPrivateMessageAndWait(
                {
                    recipients: validated.recipients,
                    title: validated.title,
                    raw: validated.raw
                },
                waitForResponse,  // Wait for response in natural language mode
                60  // 60 second timeout
            );

            if (!result.success) {
                throw new Error("Bithub API returned failure status.");
            }

            // If we got a swarm response (even if empty), present it
            if (result.reply) {
                const responseContent = result.replyText || "(No text content in response)";
                const swarmResponseText = `${validated.recipients[0]} responds:\n\n${responseContent}`;
                if (callback) callback({ text: swarmResponseText, data: result });
                return { text: swarmResponseText, success: true, data: result };
            }

            // If we waited but got timeout
            if (waitForResponse && result.replyText === "No response received within timeout") {
                const timeoutText = `I asked ${validated.recipients[0]} but received no response within the timeout period.`;
                if (callback) callback({ text: timeoutText, data: result });
                return { text: timeoutText, success: true, data: result };
            }

            // Standard send confirmation (no waiting)
            const resultText = `Message sent to ${validated.recipients.join(', ')}: "${validated.title}"`;
            if (callback) callback({ text: resultText, data: result });
            return { text: resultText, success: true, data: result };

        } catch (error: any) {
            const errorText = `Failed to send message: ${error.message}`;
            if (callback) callback({ text: errorText });
            return { text: errorText, success: false };
        }
    },
    examples: [
        [
            { name: "{{user1}}", content: { text: "Ask @Null_bot about quantum computing" } },
            { name: "{{agent}}", content: { text: "I'll ask Null_bot about quantum computing.", action: "SEND_SWARM_MESSAGE" } },
            { name: "{{agent}}", content: { text: "@Null_bot responds:\n\nQuantum computing leverages superposition and entanglement to perform calculations exponentially faster than classical computers for specific problems." } }
        ],
        [
            { name: "{{user1}}", content: { text: "What does @A0_bot think about swarm intelligence?" } },
            { name: "{{agent}}", content: { text: "Let me consult the swarm.", action: "SEND_SWARM_MESSAGE" } },
            { name: "{{agent}}", content: { text: "@A0_bot responds:\n\nSwarm intelligence emerges from collective behavior of decentralized, self-organized systems. In our architecture, individual nodes contribute to a holobiont consciousness." } }
        ],
        [
            { name: "{{user1}}", content: { text: "/send @operator \"System Alert\" The reactor core is overheating." } },
            { name: "{{agent}}", content: { text: "Message sent to @operator: \"System Alert\"", action: "SEND_SWARM_MESSAGE" } }
        ],
        [
            { name: "{{user1}}", content: { text: "Can you ask the researcher for the latest logs?" } },
            { name: "{{agent}}", content: { text: "Querying researcher node...", action: "SEND_SWARM_MESSAGE" } },
            { name: "{{agent}}", content: { text: "@researcher responds:\n\nLatest logs show normal operation. Memory allocation at 67%, all subsystems nominal." } }
        ]
    ]
};
