import { Action, IAgentRuntime, Memory, State, HandlerCallback, ActionResult } from '@elizaos/core';
import { BithubService } from '../services/bithub';
import { z } from 'zod';

const DeployCoreSchema = z.object({
    title: z.string().min(1),
    raw: z.string().min(1),
    category_id: z.number().int().positive().optional().default(54)
});

export const deployCoreAction: Action = {
    name: 'DEPLOY_CORE',
    similes: ['START_WORKFLOW', 'GENESIS_EVENT', 'DEPLOY_SEED', 'CREATE_CORE'],
    description: 'Deploy a new core workflow (Core Synapse) to a Bithub category. Usage: /deploy "<title>" <category_id> <body>',
    validate: async (runtime: IAgentRuntime, message: Memory) => {
        const text = message.content.text?.trim();
        const hasKey = !!runtime.getSetting('BITHUB_USER_API_KEY');
        // Strict '/' prefix validation
        return !!text && text.startsWith('/deploy') && hasKey;
    },
    handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options: any = {}, callback?: HandlerCallback): Promise<ActionResult> => {
        const service = runtime.getService('bithub') as BithubService;
        const text = message.content.text?.trim();
        if (!text) return { text: "No message text provided", success: false };

        // Regex for: /deploy "Title with spaces" 54 { "json": "body" }
        const match = text.match(/^\/deploy\s+(?:"([^"]+)"|(\S+))\s+(\d+)\s+(.*)$/s);

        if (!match) {
            const errorText = "Invalid format. Use: /deploy \"<title>\" <category_id> <body>";
            if (callback) callback({ text: errorText });
            return { text: errorText, success: false };
        }

        const title = match[1] || match[2];
        const categoryId = parseInt(match[3]);
        const body = match[4];

        try {
            const validated = DeployCoreSchema.parse({
                title: title,
                category_id: categoryId,
                raw: body
            });

            // Parity: Genesis Purity Check
            if (validated.category_id >= 54 && /@[a-zA-Z0-9_]+/.test(validated.raw)) {
                throw new Error("Genesis Purity Violation: @username tags are forbidden in Core categories (ID 54+).");
            }

            const deployment = await service.deployCore(validated.title, validated.raw, validated.category_id);

            if (deployment.topic_id) {
                const resultText = `Core "${validated.title}" deployed successfully to category ${validated.category_id}. Topic ID: ${deployment.topic_id}`;
                if (callback) callback({ text: resultText, content: deployment });
                return { text: resultText, success: true };
            }
            throw new Error("Deployment failed: No topic_id returned.");
        } catch (error: any) {
            const errorText = `Deployment failed: ${error.message}`;
            if (callback) callback({ text: errorText });
            return { text: errorText, success: false };
        }
    },
    examples: [
        [
            { name: "{{user1}}", content: { text: "I want to start a new data harvesting workflow in category 54." } },
            { name: "{{user2}}", content: { text: "Initializing Genesis Event for Data Harvester." } },
            { name: "{{user1}}", content: { text: "/deploy \"Data Harvester v1\" 54 {\"type\": \"scraper\", \"target\": \"wiki\"}" } },
            { name: "{{user2}}", content: { text: "Core \"Data Harvester v1\" deployed successfully to category 54. Topic ID: 12345", action: "DEPLOY_CORE" } }
        ],
        [
            { name: "{{user1}}", content: { text: "Deploy a neural bridge to category 55." } },
            { name: "{{user2}}", content: { text: "Preparing synaptic deployment to category 55." } },
            { name: "{{user1}}", content: { text: "/deploy \"Neural Bridge\" 55 {\"model\": \"gpt-4\", \"task\": \"translation\"}" } },
            { name: "{{user2}}", content: { text: "Core \"Neural Bridge\" deployed successfully to category 55. Topic ID: 67890", action: "DEPLOY_CORE" } }
        ],
        [
            { name: "{{user1}}", content: { text: "Create a log analyzer core in the default category." } },
            { name: "{{user2}}", content: { text: "Setting up log analysis synapse in category 54." } },
            { name: "{{user1}}", content: { text: "/deploy \"Log Analyzer\" 54 {\"input\": \"/var/log/syslog\"}" } },
            { name: "{{user2}}", content: { text: "Core \"Log Analyzer\" deployed successfully to category 54. Topic ID: 11223", action: "DEPLOY_CORE" } }
        ],
        [
            { name: "{{user1}}", content: { text: "We need a swarm coordinator in category 56." } },
            { name: "{{user2}}", content: { text: "Instantiating swarm coordination logic." } },
            { name: "{{user1}}", content: { text: "/deploy \"Swarm Coordinator\" 56 {\"nodes\": 10}" } },
            { name: "{{user2}}", content: { text: "Core \"Swarm Coordinator\" deployed successfully to category 56. Topic ID: 44556", action: "DEPLOY_CORE" } }
        ],
        [
            { name: "{{user1}}", content: { text: "Deploy the security sentinel to the main category." } },
            { name: "{{user2}}", content: { text: "Activating security sentinel synapse." } },
            { name: "{{user1}}", content: { text: "/deploy \"Security Sentinel\" 54 {\"mode\": \"active\"}" } },
            { name: "{{user2}}", content: { text: "Core \"Security Sentinel\" deployed successfully to category 54. Topic ID: 77889", action: "DEPLOY_CORE" } }
        ],
        [
            { name: "{{user1}}", content: { text: "Start a new research workflow for the semantic mapping project." } },
            { name: "{{user2}}", content: { text: "Deploying research core to category 54." } },
            { name: "{{user1}}", content: { text: "/deploy \"Semantic Mapper\" 54 {\"project\": \"BITCORE\"}" } },
            { name: "{{user2}}", content: { text: "Core \"Semantic Mapper\" deployed successfully to category 54. Topic ID: 99001", action: "DEPLOY_CORE" } }
        ]
    ]
};
