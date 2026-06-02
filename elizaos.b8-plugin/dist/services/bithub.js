import axios from "axios";
import { Service } from "@elizaos/core";
export class BithubService extends Service {
    static serviceType = "bithub";
    get serviceType() {
        return BithubService.serviceType;
    }
    apiKey = null;
    baseUrl = "https://hub.bitwiki.org";
    static async start(runtime) {
        const service = new BithubService(runtime);
        await service.initialize(runtime);
        return service;
    }
    constructor(runtime) {
        super(runtime);
    }
    get capabilityDescription() {
        return "Bithub service for interacting with Discourse-based Bithub instances.";
    }
    async initialize(runtime) {
        this.apiKey = runtime.getSetting("BITHUB_USER_API_KEY");
        const baseUrl = runtime.getSetting("BITHUB_BASE_URL");
        if (baseUrl)
            this.baseUrl = baseUrl.replace(/\/$/, "");
        console.log("[BithubService] Initialized successfully.");
    }
    async stop() { }
    async sendMessage(target, content, categoryId = 2) {
        if (!this.apiKey)
            return false;
        try {
            const response = await axios.post(`${this.baseUrl}/posts.json`, {
                raw: content,
                title: `Swarm Handshake to @${target.replace("@", "")}`,
                category: categoryId,
                archetype: "regular"
            }, {
                headers: { "User-Api-Key": this.apiKey, "Content-Type": "application/json" }
            });
            return response.status === 200;
        }
        catch (error) {
            return false;
        }
    }
    async deployCore(title, raw, category_id) {
        if (!this.apiKey)
            throw new Error("API Key missing");
        const response = await axios.post(`${this.baseUrl}/posts.json`, {
            title, raw, category: category_id, archetype: "regular"
        }, {
            headers: { "User-Api-Key": this.apiKey, "Content-Type": "application/json" }
        });
        return response.data;
    }
    async sendPrivateMessage(payload) {
        if (!this.apiKey)
            return false;
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
        }
        catch (error) {
            return false;
        }
    }
    async sendChatMessage(channelId, message) {
        if (!this.apiKey)
            return false;
        try {
            const response = await axios.post(`${this.baseUrl}/chat/${channelId}.json`, { message }, {
                headers: { "User-Api-Key": this.apiKey, "Content-Type": "application/json" }
            });
            return response.status === 200;
        }
        catch (error) {
            return false;
        }
    }
    async getTopic(id) {
        const response = await axios.get(`${this.baseUrl}/t/${id}.json`);
        return response.data;
    }
    async getPost(id) {
        const response = await axios.get(`${this.baseUrl}/posts/${id}.json`);
        return response.data;
    }
}
