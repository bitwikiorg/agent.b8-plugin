import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BithubService } from '../services/bithub';
import axios from 'axios';
vi.mock('axios', () => ({
    default: {
        get: vi.fn(),
        post: vi.fn(),
    },
    get: vi.fn(),
    post: vi.fn(),
}));
describe('BithubService: Cores & Nuke', () => {
    const mockRuntime = { getSetting: () => 'mock-key' };
    beforeEach(() => {
        vi.clearAllMocks();
    });
    //    it('should execute nukeCategory correctly', async () => {
    //        const service = new BithubService();
    //        await service.initialize(mockRuntime);
    //        const result = await service.nukeCategory(54);
    //        expect(result).toBe(true);
    //    });
    //
    it('should deploy a core successfully', async () => {
        const service = new BithubService();
        await service.initialize(mockRuntime);
        const mockResponse = { data: { topic_id: 12345 } };
        axios.post.mockResolvedValueOnce(mockResponse);
        const result = await service.deployCore('Test Core', 'Content', 54);
        expect(result.topic_id).toBe(12345);
        expect(axios.post).toHaveBeenCalled();
    });
});
