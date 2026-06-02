import { z } from 'zod';

export const SendPrivateMessageSchema = z.object({
 recipients: z.array(z.string()).min(1),
 title: z.string().min(1),
 raw: z.string().min(1),
});

export type SendPrivateMessage = z.infer<typeof SendPrivateMessageSchema>;

export const ReplyToPostSchema = z.object({
 topic_id: z.number().int().positive(),
 raw: z.string().min(1),
});

export type ReplyToPost = z.infer<typeof ReplyToPostSchema>;

export interface IBithubService {
 sendMessage(target: string, content: string, categoryId?: number): Promise<boolean>;
 sendPrivateMessage(payload: SendPrivateMessage): Promise<boolean>;
 replyToPost(topicId: number, raw: string, replyToPostNumber?: number): Promise<boolean>;
 deployCore(title: string, raw: string, category_id: number): Promise<any>;
 validateGenesisPurity(raw: string, categoryId: number): void;
 validatePostCompletion(topicId: number, raw: string): Promise<void>;
}
