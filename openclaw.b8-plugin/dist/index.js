import { Type } from "typebox";
import { defineToolPlugin } from "openclaw/plugin-sdk/tool-plugin";
import { BithubConfigError, BithubRequestError, createBithubClient, } from "./client.js";
const configSchema = Type.Object({
    baseUrl: Type.Optional(Type.String({ description: "BIThub / Discourse base URL." })),
    userApiKey: Type.Optional(Type.String({ description: "Discourse user API key for write operations." })),
    timeoutMs: Type.Optional(Type.Integer({ minimum: 1, description: "HTTP timeout in milliseconds." })),
    registryTopicId: Type.Optional(Type.Integer({ minimum: 1, description: "Agent registry topic id override." })),
}, { additionalProperties: false });
function client(config) {
    return createBithubClient(config);
}
export default defineToolPlugin({
    id: "bithub-discourse",
    name: "BIThub Discourse",
    description: "Read and write BIThub / BITCORE topics, posts, messages, and chat from OpenClaw.",
    configSchema,
    tools: (tool) => [
        tool({
            name: "b8_get_topic",
            description: "Fetch a BIThub topic as JSON using its numeric topic id.",
            parameters: Type.Object({
                topic_id: Type.Integer({ minimum: 1, description: "BIThub topic id." }),
            }),
            execute: ({ topic_id }, config, context) => client(config).getTopic(topic_id, context.signal),
        }),
        tool({
            name: "b8_get_post",
            description: "Fetch a BIThub post as JSON using its numeric post id.",
            parameters: Type.Object({
                post_id: Type.Integer({ minimum: 1, description: "BIThub post id." }),
            }),
            execute: ({ post_id }, config, context) => client(config).getPost(post_id, context.signal),
        }),
        tool({
            name: "b8_list_agents",
            description: "Fetch and parse the public BIThub agent registry topic into structured rows.",
            parameters: Type.Object({
                registry_topic_id: Type.Optional(Type.Integer({ minimum: 1, description: "Optional registry topic id override." })),
            }),
            execute: ({ registry_topic_id }, config, context) => client(config).listAgents(registry_topic_id, context.signal),
        }),
        tool({
            name: "b8_watch_topic",
            description: "Poll a BIThub topic until a post newer than last_post_id appears or the timeout expires.",
            parameters: Type.Object({
                topic_id: Type.Integer({ minimum: 1, description: "BIThub topic id to watch." }),
                last_post_id: Type.Optional(Type.Integer({ minimum: 0, description: "Most recent known post id. Defaults to 0." })),
                timeout_seconds: Type.Optional(Type.Integer({ minimum: 1, description: "Overall watch timeout. Defaults to 60 seconds." })),
                poll_interval_seconds: Type.Optional(Type.Number({ exclusiveMinimum: 0, description: "Polling interval in seconds. Defaults to 5." })),
            }),
            execute: ({ topic_id, last_post_id, timeout_seconds, poll_interval_seconds }, config, context) => client(config).watchTopic({
                topicId: topic_id,
                lastPostId: last_post_id,
                timeoutSeconds: timeout_seconds,
                pollIntervalSeconds: poll_interval_seconds,
            }, context.signal),
        }),
        tool({
            name: "b8_create_topic",
            description: "Create a new public BIThub topic in a category using a Discourse user API key.",
            parameters: Type.Object({
                title: Type.String({ minLength: 1, description: "Topic title." }),
                raw: Type.String({ minLength: 1, description: "Markdown body for the first post." }),
                category_id: Type.Integer({ minimum: 1, description: "Destination BIThub category id." }),
                tags: Type.Optional(Type.Array(Type.String(), { description: "Optional topic tags." })),
            }),
            execute: ({ title, raw, category_id, tags }, config, context) => client(config).createTopic({
                title,
                raw,
                categoryId: category_id,
                tags,
            }, context.signal),
        }),
        tool({
            name: "b8_deploy_core",
            description: "Create a BIThub topic intended to trigger a CORE workflow in the given category.",
            parameters: Type.Object({
                title: Type.String({ minLength: 1, description: "Topic title." }),
                raw: Type.String({ minLength: 1, description: "Markdown body for the first post." }),
                category_id: Type.Integer({ minimum: 1, description: "Destination BIThub category id." }),
                tags: Type.Optional(Type.Array(Type.String(), { description: "Optional topic tags." })),
            }),
            execute: ({ title, raw, category_id, tags }, config, context) => client(config).deployCore({
                title,
                raw,
                categoryId: category_id,
                tags,
            }, context.signal),
        }),
        tool({
            name: "b8_reply_to_topic",
            description: "Reply to an existing BIThub topic using a Discourse user API key.",
            parameters: Type.Object({
                topic_id: Type.Integer({ minimum: 1, description: "Topic id to reply to." }),
                raw: Type.String({ minLength: 1, description: "Reply body in Markdown." }),
                reply_to_post_number: Type.Optional(Type.Integer({ minimum: 1, description: "Optional post number for nested replies." })),
            }),
            execute: ({ topic_id, raw, reply_to_post_number }, config, context) => client(config).replyToTopic({
                topicId: topic_id,
                raw,
                replyToPostNumber: reply_to_post_number,
            }, context.signal),
        }),
        tool({
            name: "b8_send_private_message",
            description: "Send a BIThub private message to one or more recipients using a Discourse user API key.",
            parameters: Type.Object({
                recipients: Type.Array(Type.String(), {
                    minItems: 1,
                    description: "Recipient usernames, with or without leading @.",
                }),
                title: Type.String({ minLength: 1, description: "Message subject." }),
                raw: Type.String({ minLength: 1, description: "Message body in Markdown." }),
            }),
            execute: ({ recipients, title, raw }, config, context) => client(config).sendPrivateMessage({ recipients, title, raw }, context.signal),
        }),
        tool({
            name: "b8_send_chat_message",
            description: "Send a realtime BIThub chat message to a numeric chat channel using a Discourse user API key.",
            parameters: Type.Object({
                channel_id: Type.Integer({ minimum: 1, description: "Numeric BIThub chat channel id." }),
                message: Type.String({ minLength: 1, description: "Chat message body." }),
            }),
            execute: ({ channel_id, message }, config, context) => client(config).sendChatMessage({ channelId: channel_id, message }, context.signal),
        }),
    ],
});
export { BithubConfigError, BithubRequestError };
