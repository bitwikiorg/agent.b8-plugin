import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BithubService } from '../services/bithub';

vi.mock('@elizaos/core', () => ({ Service: class {}, ServiceType: {}, IAgentRuntime: {} }));

describe('BithubService: Cores & Nuke', () => {
    const mockRuntime = { getSetting: () => 'mock-key' } as any;

    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn());
    });

    it('should execute nukeCategory correctly', async () => {
        const service = new BithubService();
        await service.initialize(mockRuntime);

        vi.mocked(fetch)
            .mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ topic_list: { topics: [{ id: 1 }] } }))))
            .mockImplementationOnce(() => Promise.resolve(new Response(JSON.stringify({ success: true }))));

        const count = await service.nukeCategory(54);
        expect(count).toBe(1);
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});
