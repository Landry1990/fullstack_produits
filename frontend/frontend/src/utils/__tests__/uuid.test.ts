import { describe, it, expect } from 'vitest';
import { generateUUID } from '../uuid';

describe('uuid utilities', () => {
    describe('generateUUID', () => {
        it('should return a string', () => {
            expect(typeof generateUUID()).toBe('string');
        });

        it('should match UUID v4 format', () => {
            const uuid = generateUUID();
            expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        });

        it('should generate unique UUIDs', () => {
            const uuids = new Set<string>();
            for (let i = 0; i < 100; i++) {
                uuids.add(generateUUID());
            }
            expect(uuids.size).toBe(100);
        });

        it('should use crypto.randomUUID when available', () => {
            const original = crypto.randomUUID;
            let called = false;
            crypto.randomUUID = (() => { called = true; return '11111111-1111-4111-8111-111111111111'; }) as Crypto['randomUUID'];
            const result = generateUUID();
            crypto.randomUUID = original;
            expect(called).toBe(true);
            expect(result).toBe('11111111-1111-4111-8111-111111111111');
        });

        it('should fallback when crypto.randomUUID is not available', () => {
            const original = crypto.randomUUID;
            Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true });
            const uuid = generateUUID();
            crypto.randomUUID = original;
            expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        });

        it('should generate 1000 unique UUIDs', () => {
            const uuids = new Set<string>();
            for (let i = 0; i < 1000; i++) {
                uuids.add(generateUUID());
            }
            expect(uuids.size).toBe(1000);
        });
    });
});
