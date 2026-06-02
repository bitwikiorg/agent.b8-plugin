import { z } from 'zod';
export const SendPrivateMessageSchema = z.object({
    recipients: z.array(z.string()).min(1),
    title: z.string().min(1),
    raw: z.string().min(1),
});
export const ReplyToPostSchema = z.object({
    topic_id: z.number().int().positive(),
    raw: z.string().min(1),
});
