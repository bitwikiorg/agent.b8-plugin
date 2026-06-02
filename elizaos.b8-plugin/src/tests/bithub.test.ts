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

describe('BithubService: Hardened Tests', () => {
    const mockRuntime = { 
        getSetting: (key: string) => key === 'BITHUB_USER_API_KEY' ? 'mock-key' : 'https://hub.bitwiki.org' 
    } as any;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should initialize correctly', async () => {
        const service = new BithubService();
        await service.initialize(mockRuntime);
        expect(service.serviceType).toBe('bithub');
    });

    it('should fetch a topic successfully', async () => {
        const service = new BithubService();
        await service.initialize(mockRuntime);

        const mockData = { id: 1, title: 'Test Topic' };
        (axios.get as any).mockResolvedValueOnce({ data: mockData });

        const result = await service.getTopic(1);
        expect(result).toEqual(mockData);
        expect(axios.get).toHaveBeenCalledWith('https://hub.bitwiki.org/t/1.json');
    });

    it('should send a private message successfully', async () => {
        const service = new BithubService();
        await service.initialize(mockRuntime);

        (axios.post as any).mockResolvedValueOnce({ status: 200 });

        const success = await service.sendPrivateMessage({
            recipients: ['operator'],
            title: 'Alert',
            raw: 'Core overheating'
        });

        expect(success).toBe(true);
        expect(axios.post).toHaveBeenCalled();
    });

    it('should handle API errors gracefully', async () => {
        const service = new BithubService();
        await service.initialize(mockRuntime);

        (axios.post as any).mockRejectedValueOnce(new Error('Network Error'));

        const success = await service.sendPrivateMessage({
            recipients: ['operator'],
            title: 'Alert',
            raw: 'Core overheating'
        });

        expect(success).toBe(false);
    });
});
