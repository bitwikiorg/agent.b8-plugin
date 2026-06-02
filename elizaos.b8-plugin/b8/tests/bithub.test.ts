import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BithubService } from '../services/bithub';

vi.mock('@elizaos/core', () => ({ Service: class {}, ServiceType: {}, IAgentRuntime: {} }));

describe('BithubService: Hardened Tests', () => {
    const mockRuntime = { getSetting: (key: string) => key === 'BITHUB_USER_API_KEY' ? 'mock-key' : 'https://hub.bitwiki.org' } as any;

    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    it('should handle 429 with fresh response on retry', async () => {
        const service = new BithubService();
        await service.initialize(mockRuntime);

        vi.mocked(fetch)
            .mockImplementationOnce(() => Promise.resolve(new Response(null, { status: 429, headers: { 'Retry-After': '0' } })))
            .mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ success: true }))));

        const result = await service.getTopic(1);
        expect(result.success).toBe(true);
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('should fail on persistent 500 errors', async () => {
        const service = new BithubService();
        await service.initialize(mockRuntime);

        vi.mocked(fetch).mockImplementation(() => Promise.resolve(new Response('Error', { status: 500 })));

        await expect(service.getTopic(1)).rejects.toThrow('Bithub API Error (500)');
    });
});
