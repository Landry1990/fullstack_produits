import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadBlob, exportToExcel, fitExcelColumns } from '../excelExport';
import * as XLSX from 'xlsx';

vi.mock('xlsx', async importOriginal => {
    const actual = await importOriginal<typeof import('xlsx')>();
    return {
        ...actual,
        utils: {
            ...actual.utils,
            book_append_sheet: vi.fn(actual.utils.book_append_sheet),
        },
        writeFile: vi.fn(),
    };
});

describe('excelExport utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('fitExcelColumns', () => {
        it('fits headers, all rows and formatted numbers without fixed minimums', () => {
            const ws = XLSX.utils.aoa_to_sheet([
                ['ID', 'Produit', 'Montant'],
                [0, 'Paracétamol', 12345.5],
            ]);
            ws.C2.z = '#,##0.00';
            ws['!cols'] = [{ wch: 40 }];
            fitExcelColumns(ws);
            expect(ws['!cols']).toEqual([{ wch: 4 }, { wch: 13 }, { wch: 11 }]);
        });

        it('ignores pharmacy metadata and merged titles', () => {
            const ws = XLSX.utils.aoa_to_sheet([
                ['Pharmacie '.repeat(20)],
                ['ID', 'Nom'],
                [1, 'Test'],
                ['Total général '.repeat(20)],
            ]);
            ws['!merges'] = [XLSX.utils.decode_range('A4:B4')];
            fitExcelColumns(ws, 1);
            expect(ws['!cols']).toEqual([{ wch: 4 }, { wch: 6 }]);
        });

        it('uses the longest line, caps long text and considers rows beyond 200', () => {
            const ws = XLSX.utils.aoa_to_sheet([
                ['Texte', 'Notes'],
                ...Array.from({ length: 250 }, () => ['a', '']),
                ['longue ligne\ncourte', 'x'.repeat(100)],
            ]);
            fitExcelColumns(ws);
            expect(ws['!cols']).toEqual([{ wch: 14 }, { wch: 50 }]);
        });

        it('handles empty worksheets', () => {
            const ws = XLSX.utils.aoa_to_sheet([]);
            expect(() => fitExcelColumns(ws)).not.toThrow();
        });
    });

    describe('downloadBlob', () => {
        it('should create object URL and trigger download', () => {
            const createObjectURL = vi.fn(() => 'blob:test-url');
            const revokeObjectURL = vi.fn();
            Object.defineProperty(window, 'URL', {
                value: { createObjectURL, revokeObjectURL },
                writable: true,
            });

            downloadBlob(new Blob(['test']), 'file.xlsx');

            expect(createObjectURL).toHaveBeenCalledOnce();
            expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
        });

        it('should use default MIME type for xlsx', () => {
            const createObjectURL = vi.fn(() => 'blob:url');
            const revokeObjectURL = vi.fn();
            Object.defineProperty(window, 'URL', {
                value: { createObjectURL, revokeObjectURL },
                writable: true,
            });

            downloadBlob(new Blob(['data']), 'test.xlsx');

            expect(createObjectURL).toHaveBeenCalledOnce();
        });
    });

    describe('exportToExcel', () => {
        const mockSettings = {
            pharmacy_name: 'TestPharma',
            address: '123 Rue Test',
            city: 'Douala',
            phone: '690000000',
        };

        it('should call writeFile with the given filename', async () => {
            const XLSX = await import('xlsx');
            const data = [{ name: 'Item1', price: 100 }];

            exportToExcel(data, mockSettings, { filename: 'test_export.xlsx' });

            expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), 'test_export.xlsx');
        });

        it('should use default sheet name when not provided', async () => {
            const XLSX = await import('xlsx');
            const data = [{ col1: 'val1' }];

            exportToExcel(data, mockSettings, { filename: 'out.xlsx' });

            expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                'Export'
            );
        });

        it('should use custom sheet name when provided', async () => {
            const XLSX = await import('xlsx');
            const data = [{ col1: 'val1' }];

            exportToExcel(data, mockSettings, { filename: 'out.xlsx', sheetName: 'MySheet' });

            expect(XLSX.utils.book_append_sheet).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                'MySheet'
            );
        });

        it('sizes the exported table independently of pharmacy metadata', () => {
            exportToExcel([{ ID: 0, Nom: 'Test' }], {
                ...mockSettings, pharmacy_name: 'Pharmacie '.repeat(20),
            }, { filename: 'compact.xlsx', title: 'Titre '.repeat(30) });
            const workbook = vi.mocked(XLSX.writeFile).mock.calls[0][0];
            const ws = workbook.Sheets[workbook.SheetNames[0]];
            expect(ws['!cols']).toEqual([{ wch: 4 }, { wch: 6 }]);
            expect(ws.A1.v).toBe('Pharmacie '.repeat(20));
        });

        it('should handle empty data array', async () => {
            const XLSX = await import('xlsx');

            exportToExcel([], mockSettings, { filename: 'empty.xlsx' });

            expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), 'empty.xlsx');
        });

        it('should handle missing settings with defaults', async () => {
            const XLSX = await import('xlsx');
            const data = [{ a: 1 }];

            exportToExcel(data, {} as never, { filename: 'out.xlsx' });

            expect(XLSX.writeFile).toHaveBeenCalledWith(expect.anything(), 'out.xlsx');
        });
    });
});
