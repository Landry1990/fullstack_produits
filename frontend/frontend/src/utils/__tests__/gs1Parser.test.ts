import { describe, it, expect } from 'vitest';
import { parseGS1Datamatrix } from '../gs1Parser';

const GS = '\u001d';

describe('gs1Parser utilities', () => {
    describe('parseGS1Datamatrix', () => {
        it('should parse a complete GS1 datamatrix with all fields', () => {
            const raw = `01345678901234571725123110LOT123${GS}21SERABC`;
            const result = parseGS1Datamatrix(raw);
            expect(result.gtin).toBe('34567890123457');
            expect(result.cip).toBe('4567890123457');
            expect(result.lot).toBe('LOT123');
            expect(result.serial).toBe('SERABC');
            expect(result.expiration).toBe('2025-12-31');
        });

        it('should parse GTIN and extract CIP13 (drop first digit)', () => {
            const raw = '0134567890123457';
            const result = parseGS1Datamatrix(raw);
            expect(result.gtin).toBe('34567890123457');
            expect(result.cip).toBe('4567890123457');
        });

        it('should parse expiration date with year >= 50 as 19xx', () => {
            const raw = '013456789012345717991231';
            const result = parseGS1Datamatrix(raw);
            expect(result.expiration).toBe('1999-12-31');
        });

        it('should parse expiration date with year < 50 as 20xx', () => {
            const raw = '013456789012345717251231';
            const result = parseGS1Datamatrix(raw);
            expect(result.expiration).toBe('2025-12-31');
        });

        it('should parse lot number terminated by GS separator', () => {
            const raw = `10LOTABC${GS}21SER123`;
            const result = parseGS1Datamatrix(raw);
            expect(result.lot).toBe('LOTABC');
            expect(result.serial).toBe('SER123');
        });

        it('should parse lot number terminated by next AI (no GS)', () => {
            const raw = '10LOTABC21SERXYZ';
            const result = parseGS1Datamatrix(raw);
            expect(result.lot).toBe('LOTABC');
            expect(result.serial).toBe('SERXYZ');
        });

        it('should handle lot number at end of string', () => {
            const raw = '10LOTEND';
            const result = parseGS1Datamatrix(raw);
            expect(result.lot).toBe('LOTEND');
        });

        it('should handle serial number at end of string', () => {
            const raw = '21SEREND';
            const result = parseGS1Datamatrix(raw);
            expect(result.serial).toBe('SEREND');
        });

        it('should strip ]d2 prefix', () => {
            const raw = ']d201345678901234571725123110LOT${GS}';
            const result = parseGS1Datamatrix(raw);
            expect(result.gtin).toBe('34567890123457');
        });

        it('should strip ]C1 prefix', () => {
            const raw = ']C1013456789012345717251231';
            const result = parseGS1Datamatrix(raw);
            expect(result.gtin).toBe('34567890123457');
        });

        it('should return all nulls for empty string', () => {
            const result = parseGS1Datamatrix('');
            expect(result.gtin).toBeNull();
            expect(result.cip).toBeNull();
            expect(result.lot).toBeNull();
            expect(result.expiration).toBeNull();
            expect(result.serial).toBeNull();
        });

        it('should return all nulls for unrecognized input', () => {
            const result = parseGS1Datamatrix('HELLO WORLD');
            expect(result.gtin).toBeNull();
            expect(result.lot).toBeNull();
        });

        it('should limit lot number to 20 characters', () => {
            const longLot = 'A'.repeat(25);
            const raw = `10${longLot}`;
            const result = parseGS1Datamatrix(raw);
            expect(result.lot).toHaveLength(20);
        });

        it('should limit serial number to 20 characters', () => {
            const longSerial = 'S'.repeat(25);
            const raw = `21${longSerial}`;
            const result = parseGS1Datamatrix(raw);
            expect(result.serial).toHaveLength(20);
        });

        it('should handle multiple GS separators', () => {
            const raw = `0134567890123457${GS}17251231${GS}10LOT${GS}21SER`;
            const result = parseGS1Datamatrix(raw);
            expect(result.gtin).toBe('34567890123457');
            expect(result.expiration).toBe('2025-12-31');
            expect(result.lot).toBe('LOT');
            expect(result.serial).toBe('SER');
        });

        it('should parse fields in non-standard order', () => {
            const raw = `10LOTXYZ${GS}013456789012345717251231`;
            const result = parseGS1Datamatrix(raw);
            expect(result.lot).toBe('LOTXYZ');
            expect(result.gtin).toBe('34567890123457');
            expect(result.expiration).toBe('2025-12-31');
        });
    });
});
