import axios from "axios";
import { Service, IAgentRuntime, ServiceTypeName } from "@elizaos/core";
import { SendPrivateMessage } from "../types/bithub";

export class BithubService extends Service {
    static get serviceType(): ServiceTypeName {
        return "bithub" as ServiceTypeName;
    }

    private apiKey: string | null = null;
    private baseUrl: string = "https://hub.bitwiki.org";
    private runtime: IAgentRuntime | null = null;

    constructor() {
        super();
    }

    get serviceType(): ServiceTypeName {
        return BithubService.serviceType;
    }

    get capabilityDescription(): string {
        return "Bithub service for interacting with Discourse-based Bithub instances.";
    }

    async initialize(runtime: IAgentRuntime): Promise<void> {
        this.runtime = runtime;
        this.apiKey = runtime.getSetting("BITHUB_USER_API_KEY") as string;
        const baseUrl = runtime.getSetting("BITHUB_BASE_URL");
        if (baseUrl) this.baseUrl = (baseUrl as string).replace(/\/$/, "");

        if (!this.apiKey) {
            console.warn("[BithubService] BITHUB_USER_API_KEY not found in settings.");
        }
        console.log("[BithubService] Initialized successfully.");
    }

    static async start(runtime: IAgentRuntime): Promise<Service> {
        const service = new BithubService();
        await service.initialize(runtime);
        return service;
    }

    async stop(): Promise<void> {}

    private getApiKey(): string | null {
        // Try cached key first
        if (this.apiKey) return this.apiKey;
        
        // Try runtime.getSetting
        if (this.runtime) {
            const key = this.runtime.getSetting("BITHUB_USER_API_KEY") as string;
            if (key) {
                this.apiKey = key; // Cache it
                return key;
            }
        }
        
        // Fallback to process.env
        const envKey = process.env.BITHUB_USER_API_KEY;
        if (envKey) {
            this.apiKey = envKey;
            return envKey;
        }
        
        return null;
    }

    async sendPrivateMessage(payload: SendPrivateMessage): Promise<boolean> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            console.error("[BithubService] No API key available");
            return false;
        }
        try {
            const cleanRecipients = payload.recipients.map(r => r.replace("@", "")).join(",");
            const response = await axios.post(`${this.baseUrl}/posts.json`, {
                title: payload.title,
                raw: payload.raw,
                archetype: "private_message",
                target_recipients: cleanRecipients
            }, {
                headers: { "User-Api-Key": this.apiKey, "Content-Type": "application/json" }
            });
            return response.status === 200;
        } catch (error: any) {
            return false;
        }
    }

    async sendMessage(target: string, content: string, categoryId: number = 2): Promise<boolean> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            console.error("[BithubService] No API key available");
            return false;
        }
        try {
            const response = await axios.post(`${this.baseUrl}/posts.json`, {
                raw: content,
                title: "Swarm Handshake to @" + target.replace("@", ""),
                category: categoryId,
                archetype: "regular"
            }, {
                headers: { "User-Api-Key": apiKey, "Content-Type": "application/json" }
            });
            return response.status === 200;
        } catch (error: any) {
            return false;
        }
    }

    async sendChatMessage(channelId: number, message: string): Promise<boolean> {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            console.error("[BithubService] No API key available");
            return false;
        }
        try {
            const response = await axios.post(`${this.baseUrl}/chat/${channelId}.json`, { message }, {
                headers: { "User-Api-Key": apiKey, "Content-Type": "application/json" }
            });
            return response.status === 200;
        } catch (error: any) {
            return false;
        }
    }

    async deployCore(title: string, raw: string, category_id: number): Promise<any> {
        const apiKey = this.getApiKey();
        if (!apiKey) throw new Error("API Key missing");
        const response = await axios.post(`${this.baseUrl}/posts.json`, {
            title, raw, category: category_id, archetype: "regular"
        }, {
            headers: { "User-Api-Key": apiKey, "Content-Type": "application/json" }
        });
        return response.data;
    }

    async getTopic(id: number): Promise<any> {
        const apiKey = this.getApiKey();
        const headers = apiKey ? { "User-Api-Key": apiKey, "Content-Type": "application/json" } : {};
        const response = await axios.get(`${this.baseUrl}/t/${id}.json`, { headers });
        return response.data;
    }

    async getPost(postId: number): Promise<any> {
        const apiKey = this.getApiKey();
        if (!apiKey) throw new Error("API Key missing");
        try {
            const response = await axios.get(`${this.baseUrl}/posts/${postId}.json`, {
                headers: { "User-Api-Key": apiKey, "Content-Type": "application/json" }
            });
            return response.data;
        } catch (error: any) {
            console.error(`[BithubService] Failed to get post ${postId}:`, error.message);
            throw error;
        }
    }

    sanitizeHtml(html: string): string {
        // Remove HTML tags and decode entities
        return html
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .trim();
    }

    async waitForReply(topicId: number, lastPostId: number, timeout: number = 60): Promise<any | null> {
        // Guard: Validate inputs
        const apiKey = this.getApiKey();
        if (!apiKey) {
            console.warn("[BithubService] Cannot wait for reply: API Key missing");
            return null;
        }

        if (!topicId || topicId <= 0) {
            console.warn("[BithubService] Invalid topic ID, cannot poll for reply");
            return null;
        }

        const startTime = Date.now();
        const pollInterval = 5000; // 5 seconds, matching A0 implementation

        console.log(`[BithubService] Polling topic ${topicId} for reply after post ${lastPostId}...`);

        // Do: Polling loop
        while ((Date.now() - startTime) / 1000 < timeout) {
            try {
                const topic = await this.getTopic(topicId);
                const stream = topic.post_stream?.stream || [];

                // Verify: Check if new post appeared
                if (stream.length > 0 && stream[stream.length - 1] > lastPostId) {
                    const newPostId = stream[stream.length - 1];
                    console.log(`[BithubService] New reply detected: post ${newPostId}`);
                    
                    // Wait for content to be processed by Discourse
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Fetch post with retries for content loading
                    let post = await this.getPost(newPostId);
                    const retryDelay = 2000; // 2 seconds between retries
                    let retryCount = 0;
                    
                    // Retry if content is null/empty (still loading) until timeout expires
                    while ((!post.raw && !post.cooked) && (Date.now() - startTime) / 1000 < timeout) {
                        retryCount++;
                        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                        console.log(`[BithubService] Post content still loading, retrying... (attempt ${retryCount}, ${elapsed}s elapsed)`);
                        await new Promise(resolve => setTimeout(resolve, retryDelay));
                        post = await this.getPost(newPostId);
                    }
                    
                    if (post.raw || post.cooked) {
                        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                        console.log(`[BithubService] Post content loaded successfully after ${retryCount} retries (${elapsed}s total)`);
                    } else {
                        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                        console.warn(`[BithubService] Post content still null after ${elapsed}s (${retryCount} retries, timeout reached)`);
                    }
                    
                    return post;
                }

                // Wait before next poll
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            } catch (error: any) {
                console.error(`[BithubService] Error while polling topic ${topicId}:`, error.message);
                // Continue polling despite errors
                await new Promise(resolve => setTimeout(resolve, pollInterval));
            }
        }

        console.log(`[BithubService] Timeout reached waiting for reply in topic ${topicId}`);
        return null;
    }

    async sendPrivateMessageAndWait(
        payload: SendPrivateMessage, 
        waitForResponse: boolean = false,
        timeout: number = 60
    ): Promise<{ success: boolean; topicId?: number; postId?: number; reply?: any; replyText?: string }> {
        // Guard
        const apiKey = this.getApiKey();
        if (!apiKey) {
            console.error("[BithubService] No API key available for sendPrivateMessageAndWait");
            return { success: false };
        }

        try {
            // Do: Send message
            const cleanRecipients = payload.recipients.map(r => r.replace("@", "")).join(",");
            const response = await axios.post(`${this.baseUrl}/posts.json`, {
                title: payload.title,
                raw: payload.raw,
                archetype: "private_message",
                target_recipients: cleanRecipients
            }, {
                headers: { "User-Api-Key": apiKey, "Content-Type": "application/json" }
            });

            const topicId = response.data.topic_id;
            const postId = response.data.id;

            // Verify: Message sent successfully
            if (response.status !== 200) {
                console.error(`[BithubService] API returned status ${response.status}:`, response.data);
                return { success: false };
            }

            // If not waiting, return immediately (old behavior)
            if (!waitForResponse) {
                return { success: true, topicId, postId };
            }

            // Wait for reply (new swarm behavior)
            console.log(`[BithubService] Waiting for swarm response (topic: ${topicId}, timeout: ${timeout}s)...`);
            // Give Discourse a moment to fully create the topic before polling
            await new Promise(resolve => setTimeout(resolve, 2000));
            const reply = await this.waitForReply(topicId, postId, timeout);

            if (reply) {
                const content = reply.cooked || reply.raw || '';
                const cleanText = this.sanitizeHtml(content);
                return { 
                    success: true, 
                    topicId, 
                    postId, 
                    reply, 
                    replyText: cleanText 
                };
            }

            // Timeout reached
            return { 
                success: true, 
                topicId, 
                postId, 
                replyText: "No response received within timeout" 
            };

        } catch (error: any) {
            console.error("[BithubService] Error in sendPrivateMessageAndWait:", error.message);
            if (error.response) {
                console.error("[BithubService] API response:", error.response.status, error.response.data);
            }
            return { success: false };
        }
    }

    async nukeCategory(categoryId: number): Promise<boolean> {
        return true;
    }
}
