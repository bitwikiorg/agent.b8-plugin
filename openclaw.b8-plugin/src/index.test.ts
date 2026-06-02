import { describe, expect, it, vi } from "vitest";
import entry from "./index.js";
import { getToolPluginMetadata } from "openclaw/plugin-sdk/tool-plugin";
import {
  BithubClient,
  BithubConfigError,
  extractPostIds,
  normalizeRecipients,
  normalizeTags,
  parseAgentRegistry,
} from "./client.js";

describe("bithub-discourse metadata", () => {
  it("declares the expected tool surface", () => {
    expect(getToolPluginMetadata(entry)?.tools.map((tool) => tool.name)).toEqual([
      "b8_get_topic",
      "b8_get_post",
      "b8_list_agents",
      "b8_watch_topic",
      "b8_create_topic",
      "b8_deploy_core",
      "b8_reply_to_topic",
      "b8_send_private_message",
      "b8_send_chat_message",
    ]);
  });
});

describe("registry parsing", () => {
  it("keeps the construct table and skips later two-column detail tables", () => {
    const raw = [
      "| # | Construct | Username |",
      "| ---: | --- | --- |",
      "| 1 | **Hermes** | `@hermes` |",
      "| 2 | Janus | `@janus_bot` |",
      "",
      "| Field | Value |",
      "| --- | --- |",
      "| Username | `@should_not_parse` |",
    ].join("\n");

    expect(parseAgentRegistry(raw)).toEqual([
      { construct: "Hermes", username: "hermes" },
      { construct: "Janus", username: "janus_bot" },
    ]);
  });
});

describe("normalization helpers", () => {
  it("normalizes tags and private-message recipients", () => {
    expect(normalizeTags(["Core Ops", " Launch  ", ""])).toEqual(["core-ops", "launch"]);
    expect(normalizeRecipients(["`@janus_bot`", " hermes ", "@janus_bot"])).toEqual([
      "janus_bot",
      "hermes",
    ]);
  });

  it("extracts post ids from stream or posts", () => {
    expect(extractPostIds({ post_stream: { stream: [11, 12, 13] } })).toEqual([11, 12, 13]);
    expect(extractPostIds({ post_stream: { posts: [{ id: 22 }, { id: 23 }] } })).toEqual([22, 23]);
  });
});

describe("BithubClient", () => {
  it("builds the expected create-topic request", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ id: 101, topic_id: 55 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const client = new BithubClient({
      baseUrl: "https://hub.bitwiki.org/",
      userApiKey: "secret-key",
      timeoutMs: 12_000,
      fetchImpl: fetchImpl as typeof fetch,
    });

    const payload = await client.createTopic({
      title: "Launch core",
      raw: "Deploy this core.",
      categoryId: 42,
      tags: ["Core Ops", "Launch"],
    });

    expect(payload).toEqual({ id: 101, topic_id: 55 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hub.bitwiki.org/posts.json");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["User-Api-Key"]).toBe("secret-key");
    expect(JSON.parse(String(init?.body))).toEqual({
      title: "Launch core",
      raw: "Deploy this core.",
      category: 42,
      tags: ["core-ops", "launch"],
    });
  });

  it("fetches the first post separately when topic raw is absent", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ post_stream: { posts: [{ id: 17 }] } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            raw: "| Construct | Username |\n| --- | --- |\n| Hermes | `@hermes` |",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );
    const client = new BithubClient({ fetchImpl: fetchImpl as typeof fetch });

    const agents = await client.listAgents(30145);

    expect(agents).toEqual([{ construct: "Hermes", username: "hermes" }]);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://hub.bitwiki.org/t/30145.json");
    expect(fetchImpl.mock.calls[1]?.[0]).toBe("https://hub.bitwiki.org/posts/17.json");
  });

  it("requires a user API key for write operations", async () => {
    const client = new BithubClient({ userApiKey: "", fetchImpl: vi.fn() as typeof fetch });
    await expect(
      client.sendPrivateMessage({ recipients: ["janus"], title: "Sync", raw: "Ping." }),
    ).rejects.toBeInstanceOf(BithubConfigError);
  });
});
