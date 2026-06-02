/**
 * WHY: To ensure synaptic data integrity by validating Zod schemas against expected payloads.
 * WHAT: Unit tests for SendPrivateMessage, ReplyToPost, and Notification schemas.
 * HOW: Uses Vitest to assert that valid data passes and invalid data is rejected (Guard -> Do -> Verify).
 */

import { describe, it, expect } from 'vitest';
import { SendPrivateMessageSchema, ReplyToPostSchema } from '../types/bithub';

describe('Bithub Zod Schemas: Contract Validation', () => {
    it('should validate SendPrivateMessage with strict requirements (Guard/Verify)', () => {
        const validData = {
            recipients: ['user1'],
            title: 'Subject',
            raw: 'Body content'
        };

        // Do & Verify
        const result = SendPrivateMessageSchema.parse(validData);
        expect(result).toEqual(validData);

        // Guard: Invalid data should throw
        expect(() => SendPrivateMessageSchema.parse({ ...validData, recipients: [] })).toThrow();
    });

    it('should validate ReplyToPost schema (Guard/Verify)', () => {
        const validData = {
            topic_id: 123,
            raw: 'Synaptic reply'
        };

        // Do & Verify
        const result = ReplyToPostSchema.parse(validData);
        expect(result).toEqual(validData);

        // Guard: Missing topic_id
        expect(() => ReplyToPostSchema.parse({ raw: 'No ID' })).toThrow();
    });
});
