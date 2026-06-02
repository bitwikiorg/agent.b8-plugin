export type BithubPluginConfig = {
    baseUrl?: string;
    userApiKey?: string;
    timeoutMs?: number;
    registryTopicId?: number;
};
export type BithubClientOptions = {
    baseUrl?: string;
    userApiKey?: string;
    timeoutMs?: number;
    registryTopicId?: number;
    fetchImpl?: typeof fetch;
};
export declare class BithubConfigError extends Error {
    constructor(message: string);
}
export declare class BithubRequestError extends Error {
    readonly statusCode?: number;
    constructor(message: string, statusCode?: number);
}
export declare class BithubClient {
    readonly baseUrl: string;
    readonly userApiKey?: string;
    readonly timeoutMs: number;
    readonly registryTopicId: number;
    private readonly fetchImpl;
    constructor(options?: BithubClientOptions);
    getTopic(topicId: number, signal?: AbortSignal): Promise<Record<string, unknown>>;
    getPost(postId: number, signal?: AbortSignal): Promise<Record<string, unknown>>;
    createTopic(params: {
        title: string;
        raw: string;
        categoryId: number;
        tags?: string[];
    }, signal?: AbortSignal): Promise<Record<string, unknown>>;
    deployCore(params: {
        title: string;
        raw: string;
        categoryId: number;
        tags?: string[];
    }, signal?: AbortSignal): Promise<Record<string, unknown>>;
    replyToTopic(params: {
        topicId: number;
        raw: string;
        replyToPostNumber?: number;
    }, signal?: AbortSignal): Promise<Record<string, unknown>>;
    sendPrivateMessage(params: {
        recipients: string[];
        title: string;
        raw: string;
    }, signal?: AbortSignal): Promise<Record<string, unknown>>;
    sendChatMessage(params: {
        channelId: number;
        message: string;
    }, signal?: AbortSignal): Promise<Record<string, unknown>>;
    watchTopic(params: {
        topicId: number;
        lastPostId?: number;
        timeoutSeconds?: number;
        pollIntervalSeconds?: number;
    }, signal?: AbortSignal): Promise<Record<string, unknown> | null>;
    listAgents(registryTopicId?: number, signal?: AbortSignal): Promise<Array<Record<string, string>>>;
    private getFirstPostRaw;
    private requestJson;
}
export declare function createBithubClient(config?: BithubPluginConfig, fetchImpl?: typeof fetch): BithubClient;
export declare function parseAgentRegistry(raw: string): Array<Record<string, string>>;
export declare function normalizeRecipients(values: string[]): string[];
export declare function normalizeTags(values: string[]): string[];
export declare function extractPostIds(topic: Record<string, unknown>): number[];
