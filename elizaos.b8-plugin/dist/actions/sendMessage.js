import { z } from 'zod';
const SendMessageSchema = z.object({
    recipients: z.array(z.string().regex(/^@?[\w\d_-]+$/)).min(1),
    title: z.string().min(1),
    raw: z.string().min(1),
});
export const sendMessageAction = {
    name: 'SEND_SWARM_MESSAGE',
    similes: ['SEND_BITHUB_MESSAGE', 'MESSAGE_AGENT', 'PRIVATE_MESSAGE', 'DM_AGENT'],
    description: 'Send a private message to one or more agents in the Bithub swarm. Usage: /send <recipient> "<title>" <body>',
    validate: async (runtime, message) => {
        // Validation checks prerequisites only, not input format
        // Action should be available whenever API key is configured
        // This allows both slash commands (/send) and LLM-triggered natural language
        return !!runtime.getSetting('BITHUB_USER_API_KEY');
    },
    handler: async (runtime, message, state, _options = {}, callback) => {
        const service = runtime.getService('bithub');
        const text = message.content.text?.trim();
        if (!text)
            return { text: "No message text provided", success: false };
        // Mode 1: Slash command (/send @recipient "title" body)
        if (text.startsWith('/send')) {
            const match = text.match(/^\/send\s+(@?[\w\d_-]+)\s+(?:"([^"]+)"|(\S+))\s+(.*)$/s);
            if (!match) {
                const errorText = "Invalid format. Use: /send <recipient> \"<title>\" <body>";
                if (callback)
                    callback({ text: errorText });
                return { text: errorText, success: false };
            }
            const recipient = match[1];
            const title = match[2] || match[3];
            const body = match[4];
            try {
                const validated = SendMessageSchema.parse({
                    recipients: [recipient],
                    title: title,
                    raw: body
                });
                const success = await service.sendPrivateMessage({
                    recipients: validated.recipients,
                    title: validated.title,
                    raw: validated.raw
                });
                if (success) {
                    const resultText = `Successfully sent message to ${validated.recipients.join(', ')}: "${validated.title}"`;
                    if (callback)
                        callback({ text: resultText, content: validated });
                    return { text: resultText, success: true };
                }
                throw new Error("Bithub API returned failure status.");
            }
            catch (error) {
                const errorText = `Failed to send message: ${error.message}`;
                if (callback)
                    callback({ text: errorText });
                return { text: errorText, success: false };
            }
        }
        // Mode 2: Natural language (LLM-triggered) - Extract @mentions
        const mentions = text.match(/@([\w\d_-]+)/g);
        if (!mentions || mentions.length === 0) {
            const errorText = "No recipient found. Please specify using @username or use: /send <recipient> \"<title>\" <body>";
            if (callback)
                callback({ text: errorText });
            return { text: errorText, success: false };
        }
        const recipients = mentions.map(m => m.substring(1)); // Remove @ prefix
        const title = `Query from ${runtime.character.name}`;
        const body = text;
        try {
            const validated = SendMessageSchema.parse({
                recipients: recipients,
                title: title,
                raw: body
            });
            const success = await service.sendPrivateMessage({
                recipients: validated.recipients,
                title: validated.title,
                raw: validated.raw
            });
            if (success) {
                const resultText = `Successfully consulted ${validated.recipients.map(r => '@' + r).join(', ')}: "${validated.title}"`;
                if (callback)
                    callback({ text: resultText, content: validated });
                return { text: resultText, success: true };
            }
            throw new Error("Bithub API returned failure status.");
        }
        catch (error) {
            const errorText = `Failed to send message: ${error.message}`;
            if (callback)
                callback({ text: errorText });
            return { text: errorText, success: false };
        }
    },
    examples: [
        [
            { name: "{{user1}}", content: { text: "I need to alert the operator about the core temperature." } },
            { name: "{{user2}}", content: { text: "Understood. I will use the /send command to notify @operator." } },
            { name: "{{user1}}", content: { text: "/send @operator \"System Alert\" The reactor core is overheating." } },
            { name: "{{user2}}", content: { text: "Successfully sent message to @operator: \"System Alert\"", action: "SEND_SWARM_MESSAGE" } }
        ],
        [
            { name: "{{user1}}", content: { text: "Can you ask the researcher for the latest logs?" } },
            { name: "{{user2}}", content: { text: "Initiating request via Bithub Neural Net Link." } },
            { name: "{{user1}}", content: { text: "/send @researcher DataRequest Please provide the latest logs." } },
            { name: "{{user2}}", content: { text: "Successfully sent message to @researcher: \"DataRequest\"", action: "SEND_SWARM_MESSAGE" } }
        ],
        [
            { name: "{{user1}}", content: { text: "Ping null_bot to check connectivity." } },
            { name: "{{user2}}", content: { text: "Executing handshake protocol." } },
            { name: "{{user1}}", content: { text: "/send @null_bot \"Ping Test\" Hello?" } },
            { name: "{{user2}}", content: { text: "Successfully sent message to @null_bot: \"Ping Test\"", action: "SEND_SWARM_MESSAGE" } }
        ],
        [
            { name: "{{user1}}", content: { text: "Report the security breach to admin immediately." } },
            { name: "{{user2}}", content: { text: "Routing urgent alert to @admin." } },
            { name: "{{user1}}", content: { text: "/send @admin \"Urgent: Security Breach\" Multiple unauthorized login attempts detected." } },
            { name: "{{user2}}", content: { text: "Successfully sent message to @admin: \"Urgent: Security Breach\"", action: "SEND_SWARM_MESSAGE" } }
        ],
        [
            { name: "{{user1}}", content: { text: "Tell the coordinator that all nodes are operational." } },
            { name: "{{user2}}", content: { text: "Sending status update to swarm coordinator." } },
            { name: "{{user1}}", content: { text: "/send @coordinator \"Status Update\" All nodes are operational." } },
            { name: "{{user2}}", content: { text: "Successfully sent message to @coordinator: \"Status Update\"", action: "SEND_SWARM_MESSAGE" } }
        ],
        [
            { name: "{{user1}}", content: { text: "Send a message to the archon about the research findings." } },
            { name: "{{user2}}", content: { text: "Formatting research data for @archon." } },
            { name: "{{user1}}", content: { text: "/send @archon \"Research Findings\" The semantic mapping is complete." } },
            { name: "{{user2}}", content: { text: "Successfully sent message to @archon: \"Research Findings\"", action: "SEND_SWARM_MESSAGE" } }
        ]
    ]
};
