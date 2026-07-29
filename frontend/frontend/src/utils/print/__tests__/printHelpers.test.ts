import { describe, it, expect, vi } from 'vitest';
import { escHtml, formatMoney, formatDateFr, getModeLabel, writePrintDocument } from '../printHelpers';

// Helper: strip narrow no-break spaces for comparison
const stripNbsp = (s: string) => s.replace(/[\u00A0\u202F]/g, ' ');

describe('printHelpers utilities', () => {
    describe('escHtml', () => {
        it('should escape ampersands', () => {
            expect(escHtml('a & b')).toBe('a &amp; b');
        });

        it('should escape less-than', () => {
            expect(escHtml('a < b')).toBe('a &lt; b');
        });

        it('should escape greater-than', () => {
            expect(escHtml('a > b')).toBe('a &gt; b');
        });

        it('should escape double quotes', () => {
            expect(escHtml('say "hi"')).toBe('say &quot;hi&quot;');
        });

        it('should escape single quotes', () => {
            expect(escHtml("it's")).toBe('it&#x27;s');
        });

        it('should escape all special chars together', () => {
            expect(escHtml('<script>alert("x") & \'y\'</script>')).toBe(
                '&lt;script&gt;alert(&quot;x&quot;) &amp; &#x27;y&#x27;&lt;/script&gt;'
            );
        });

        it('should return empty string for null', () => {
            expect(escHtml(null)).toBe('');
        });

        it('should return empty string for undefined', () => {
            expect(escHtml(undefined)).toBe('');
        });

        it('should stringify non-string values', () => {
            expect(escHtml(42)).toBe('42');
        });

        it('should not alter plain text', () => {
            expect(escHtml('Hello World')).toBe('Hello World');
        });
    });

    describe('formatMoney', () => {
        it('should format an integer', () => {
            expect(stripNbsp(formatMoney(1000))).toBe('1 000');
        });

        it('should format a string number', () => {
            expect(stripNbsp(formatMoney('2500'))).toBe('2 500');
        });

        it('should round decimals', () => {
            expect(stripNbsp(formatMoney(999.99))).toBe('1 000');
        });

        it('should handle zero', () => {
            expect(formatMoney(0)).toBe('0');
        });

        it('should handle negative numbers', () => {
            expect(stripNbsp(formatMoney(-500))).toBe('-500');
        });

        it('should handle NaN string gracefully', () => {
            expect(typeof formatMoney('NaN')).toBe('string');
        });
    });

    describe('formatDateFr', () => {
        it('should return empty string for empty input', () => {
            expect(formatDateFr('')).toBe('');
        });

        it('should format a valid ISO date string', () => {
            const result = formatDateFr('2025-01-15T10:30:00');
            expect(result).toContain('2025');
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('getModeLabel', () => {
        it('should return label for known mode (especes)', () => {
            const result = getModeLabel('especes');
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should return label for known mode (cheque)', () => {
            const result = getModeLabel('cheque');
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should return label for known mode (carte)', () => {
            const result = getModeLabel('carte');
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should return label for known mode (virement)', () => {
            const result = getModeLabel('virement');
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should return label for known mode (om)', () => {
            const result = getModeLabel('om');
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should return label for known mode (momo)', () => {
            const result = getModeLabel('momo');
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should return label for known mode (coupon)', () => {
            const result = getModeLabel('coupon');
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should return label for known mode (en_compte)', () => {
            const result = getModeLabel('en_compte');
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should return uppercase for unknown mode', () => {
            expect(getModeLabel('unknown')).toBe('UNKNOWN');
        });

        it('should return N/A for empty/undefined mode', () => {
            expect(getModeLabel('')).toBe('N/A');
        });
    });

    describe('writePrintDocument', () => {
        it('should inject HTML content into the window document', () => {
            // Mock window with a real document-like object
            const mockDoc = {
                head: { innerHTML: '' },
                body: { innerHTML: '' },
                title: '',
                querySelectorAll: vi.fn(() => []),
                createElement: vi.fn(() => ({ src: '', textContent: '', parentNode: { replaceChild: vi.fn() } })),
            };
            const mockWin = { document: mockDoc } as unknown as Window;

            writePrintDocument(mockWin, '<html><head><title>Test</title></head><body><h1>Hello</h1></body></html>');

            expect(mockDoc.title).toBe('Test');
            expect(mockDoc.body.innerHTML).toContain('Hello');
        });

        it('should re-execute inline scripts', () => {
            const mockDoc = {
                head: { innerHTML: '' },
                body: { innerHTML: '' },
                title: '',
                querySelectorAll: vi.fn(() => [
                    { src: '', textContent: 'window.__testVar = 42;', parentNode: { replaceChild: vi.fn() } },
                ]),
                createElement: vi.fn(() => ({ src: '', textContent: '', parentNode: { replaceChild: vi.fn() } })),
            };
            const mockWin = { document: mockDoc } as unknown as Window;

            writePrintDocument(mockWin, '<html><head><title>Script Test</title></head><body><script>window.__testVar = 42;</script></body></html>');

            expect(mockDoc.title).toBe('Script Test');
            expect(mockDoc.querySelectorAll).toHaveBeenCalledWith('script');
        });
    });
});
