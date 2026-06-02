const DEFAULT_BASE_URL = "https://hub.bitwiki.org";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_REGISTRY_TOPIC_ID = 30_145;
const WRITE_API_KEY_ENV_VARS = ["B8_USER_API_KEY", "BITHUB_USER_API_KEY"] as const;
const BASE_URL_ENV_VARS = ["B8_BASE_URL", "BITHUB_BASE_URL", "BITHUB_URL"] as const;

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

export class BithubConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BithubConfigError";
  }
}

export class BithubRequestError extends Error {
  readonly statusCode?: number;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "BithubRequestError";
    this.statusCode = statusCode;
  }
}

export class BithubClient {
  readonly baseUrl: string;
  readonly userApiKey?: string;
  readonly timeoutMs: number;
  readonly registryTopicId: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: BithubClientOptions = {}) {
    this.baseUrl = resolveBaseUrl(options.baseUrl);
    this.userApiKey = resolveUserApiKey(options.userApiKey);
    this.timeoutMs = resolveTimeoutMs(options.timeoutMs);
    this.registryTopicId = resolveRegistryTopicId(options.registryTopicId);
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getTopic(topicId: number, signal?: AbortSignal): Promise<Record<string, unknown>> {
    return this.requestJson("GET", `/t/${positiveInt(topicId, "topic_id")}.json`, { signal });
  }

  async getPost(postId: number, signal?: AbortSignal): Promise<Record<string, unknown>> {
    return this.requestJson("GET", `/posts/${positiveInt(postId, "post_id")}.json`, { signal });
  }

  async createTopic(
    params: { title: string; raw: string; categoryId: number; tags?: string[] },
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = {
      title: requiredText(params.title, "title"),
      raw: requiredText(params.raw, "raw"),
      category: positiveInt(params.categoryId, "category_id"),
    };
    const tags = normalizeTags(params.tags ?? []);
    if (tags.length > 0) {
      body.tags = tags;
    }
    return this.requestJson("POST", "/posts.json", { authRequired: true, jsonBody: body, signal });
  }

  async deployCore(
    params: { title: string; raw: string; categoryId: number; tags?: string[] },
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    return this.createTopic(params, signal);
  }

  async replyToTopic(
    params: { topicId: number; raw: string; replyToPostNumber?: number },
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = {
      topic_id: positiveInt(params.topicId, "topic_id"),
      raw: requiredText(params.raw, "raw"),
    };
    if (params.replyToPostNumber != null) {
      body.reply_to_post_number = positiveInt(params.replyToPostNumber, "reply_to_post_number");
    }
    return this.requestJson("POST", "/posts.json", { authRequired: true, jsonBody: body, signal });
  }

  async sendPrivateMessage(
    params: { recipients: string[]; title: string; raw: string },
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const recipients = normalizeRecipients(params.recipients);
    return this.requestJson("POST", "/posts.json", {
      authRequired: true,
      signal,
      jsonBody: {
        title: requiredText(params.title, "title"),
        raw: requiredText(params.raw, "raw"),
        archetype: "private_message",
        target_recipients: recipients.join(","),
      },
    });
  }

  async sendChatMessage(
    params: { channelId: number; message: string },
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    return this.requestJson("POST", `/chat/${positiveInt(params.channelId, "channel_id")}.json`, {
      authRequired: true,
      signal,
      jsonBody: { message: requiredText(params.message, "message") },
    });
  }

  async watchTopic(
    params: {
      topicId: number;
      lastPostId?: number;
      timeoutSeconds?: number;
      pollIntervalSeconds?: number;
    },
    signal?: AbortSignal,
  ): Promise<Record<string, unknown> | null> {
    const topicId = positiveInt(params.topicId, "topic_id");
    const lastPostId = nonNegativeInt(params.lastPostId ?? 0, "last_post_id");
    const timeoutSeconds = positiveInt(params.timeoutSeconds ?? 60, "timeout_seconds");
    const pollIntervalSeconds = positiveNumber(params.pollIntervalSeconds ?? 5, "poll_interval_seconds");
    const deadline = Date.now() + timeoutSeconds * 1000;

    while (Date.now() < deadline) {
      signal?.throwIfAborted();
      const topic = await this.getTopic(topicId, signal);
      const postIds = extractPostIds(topic);
      if (postIds.length > 0 && postIds[postIds.length - 1]! > lastPostId) {
        return this.getPost(postIds[postIds.length - 1]!, signal);
      }
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        break;
      }
      await sleep(Math.min(remainingMs, pollIntervalSeconds * 1000), signal);
    }

    return null;
  }

  async listAgents(registryTopicId?: number, signal?: AbortSignal): Promise<Array<Record<string, string>>> {
    const topic = await this.getTopic(registryTopicId ?? this.registryTopicId, signal);
    const raw = await this.getFirstPostRaw(topic, signal);
    return parseAgentRegistry(raw);
  }

  private async getFirstPostRaw(topic: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    const postStream = asRecord(topic.post_stream);
    const posts = Array.isArray(postStream?.posts) ? postStream.posts : [];
    if (posts.length > 0) {
      const first = asRecord(posts[0]);
      const raw = typeof first?.raw === "string" ? first.raw.trim() : "";
      if (raw) {
        return raw;
      }
      const firstId = first?.id;
      if (typeof firstId === "number") {
        const post = await this.getPost(firstId, signal);
        return stringValue(post.raw);
      }
    }

    const stream = Array.isArray(postStream?.stream) ? postStream.stream : [];
    if (typeof stream[0] === "number") {
      const post = await this.getPost(stream[0], signal);
      return stringValue(post.raw);
    }

    throw new BithubRequestError("Registry topic has no readable posts.");
  }

  private async requestJson(
    method: string,
    path: string,
    options: {
      authRequired?: boolean;
      jsonBody?: Record<string, unknown>;
      signal?: AbortSignal;
    } = {},
  ): Promise<Record<string, unknown>> {
    if (options.authRequired && !this.userApiKey) {
      throw new BithubConfigError(
        "Write operations require a BIThub Discourse user API key. Configure plugins.entries.bithub-discourse with userApiKey or export B8_USER_API_KEY/BITHUB_USER_API_KEY.",
      );
    }

    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "OpenClaw BIThub Discourse plugin/0.1.0",
    };
    if (options.authRequired && this.userApiKey) {
      headers["User-Api-Key"] = this.userApiKey;
    }

    const signal = mergeSignals(options.signal, this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method,
        headers,
        body: options.jsonBody ? JSON.stringify(options.jsonBody) : undefined,
        signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new BithubRequestError(`BIThub request timed out or was aborted for ${path}.`);
      }
      throw new BithubRequestError(`BIThub request failed for ${path}: ${String(error)}`);
    }

    if (!response.ok) {
      const detail = (await safeResponseText(response)).trim() || response.statusText || "HTTP error";
      throw new BithubRequestError(
        `BIThub API request failed (${response.status}) for ${path}: ${detail}`,
        response.status,
      );
    }

    if (response.status === 204) {
      return {};
    }

    try {
      return (await response.json()) as Record<string, unknown>;
    } catch {
      throw new BithubRequestError(`BIThub API returned non-JSON for ${path}.`, response.status);
    }
  }
}

export function createBithubClient(config: BithubPluginConfig = {}, fetchImpl?: typeof fetch): BithubClient {
  return new BithubClient({
    baseUrl: config.baseUrl,
    userApiKey: config.userApiKey,
    timeoutMs: config.timeoutMs,
    registryTopicId: config.registryTopicId,
    fetchImpl,
  });
}

export function parseAgentRegistry(raw: string): Array<Record<string, string>> {
  const rows: Array<Record<string, string>> = [];
  for (const block of extractMarkdownTableBlocks(raw)) {
    if (block.length < 2) {
      continue;
    }
    const headerCells = splitMarkdownRow(block[0]!);
    const separatorCells = splitMarkdownRow(block[1]!);
    if (headerCells.length === 0 || !isSeparatorRow(separatorCells)) {
      continue;
    }

    const keys = headerCells.map(normalizeHeaderCell);
    if (!keys.includes("username")) {
      continue;
    }
    if (!keys.some((key) => ["construct", "name", "agent", "persona"].includes(key))) {
      continue;
    }

    for (const line of block.slice(2)) {
      const cells = splitMarkdownRow(line);
      if (cells.length === 0 || isSeparatorRow(cells)) {
        continue;
      }
      const row: Record<string, string> = {};
      keys.forEach((key, index) => {
        if (!key) {
          return;
        }
        row[key] = cleanMarkdownCell(cells[index] ?? "");
      });
      const username = row.username || row.user || row.agent || row.handle;
      if (!username) {
        continue;
      }
      const normalizedUsername = cleanUsername(username);
      if (!normalizedUsername || normalizedUsername.toLowerCase() === "username") {
        continue;
      }
      row.username = normalizedUsername;
      rows.push(row);
    }
  }
  return rows;
}

export function normalizeRecipients(values: string[]): string[] {
  const cleaned = values
    .map((value) => cleanUsername(cleanMarkdownCell(String(value))))
    .filter((value) => value.length > 0);
  const deduped = [...new Set(cleaned)];
  if (deduped.length === 0) {
    throw new BithubConfigError("recipients is required.");
  }
  return deduped;
}

export function normalizeTags(values: string[]): string[] {
  return values
    .map((value) =>
      cleanMarkdownCell(String(value))
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, ""),
    )
    .filter((value) => value.length > 0);
}

export function extractPostIds(topic: Record<string, unknown>): number[] {
  const postStream = asRecord(topic.post_stream);
  const stream = Array.isArray(postStream?.stream) ? postStream.stream : [];
  const explicit = stream.filter((value): value is number => typeof value === "number");
  if (explicit.length > 0) {
    return explicit;
  }
  const posts = Array.isArray(postStream?.posts) ? postStream.posts : [];
  return posts
    .map((post) => asRecord(post)?.id)
    .filter((value): value is number => typeof value === "number");
}

function resolveBaseUrl(value?: string): string {
  const candidate = (value ?? firstDefinedEnv(BASE_URL_ENV_VARS) ?? DEFAULT_BASE_URL).trim();
  if (!candidate) {
    throw new BithubConfigError("baseUrl is empty.");
  }
  return candidate.replace(/\/+$/, "");
}

function resolveUserApiKey(value?: string): string | undefined {
  const candidate = (value ?? firstDefinedEnv(WRITE_API_KEY_ENV_VARS) ?? "").trim();
  return candidate || undefined;
}

function resolveTimeoutMs(value?: number): number {
  const timeout = value ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new BithubConfigError("timeoutMs must be a positive number.");
  }
  return timeout;
}

function resolveRegistryTopicId(value?: number): number {
  return positiveInt(value ?? DEFAULT_REGISTRY_TOPIC_ID, "registry_topic_id");
}

function positiveInt(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new BithubConfigError(`${fieldName} must be a positive integer.`);
  }
  return value;
}

function nonNegativeInt(value: number, fieldName: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new BithubConfigError(`${fieldName} must be zero or a positive integer.`);
  }
  return value;
}

function positiveNumber(value: number, fieldName: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new BithubConfigError(`${fieldName} must be positive.`);
  }
  return value;
}

function requiredText(value: string, fieldName: string): string {
  const cleaned = String(value ?? "").trim();
  if (!cleaned) {
    throw new BithubConfigError(`${fieldName} is required.`);
  }
  return cleaned;
}

function firstDefinedEnv(keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return undefined;
}

function mergeSignals(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!signal) {
    return timeoutSignal;
  }
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any([signal, timeoutSignal]);
  }
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  timeoutSignal.addEventListener("abort", abort, { once: true });
  return controller.signal;
}

async function safeResponseText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (!signal) {
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function extractMarkdownTableBlocks(raw: string): string[][] {
  const lines = String(raw ?? "").split(/\r?\n/);
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (/^\s*\|/.test(line)) {
      current.push(line);
      continue;
    }
    if (current.length > 0) {
      blocks.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    blocks.push(current);
  }
  return blocks;
}

function splitMarkdownRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function normalizeHeaderCell(value: string): string {
  return cleanMarkdownCell(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cleanMarkdownCell(value: string): string {
  return value
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .trim();
}

function cleanUsername(value: string): string {
  return cleanMarkdownCell(value).replace(/^@+/, "").trim();
}
