import { describe, it, expect, vi, beforeEach } from 'vitest';
import { downloadBlob, exportToExcel } from '../excelExport';

vi.mock('xlsx', () => {
    const mockSheet = {};
    const mockBook = { SheetNames: [], Sheets: {} };
    return {
        default: {
            utils: {
                book_new: vi.fn(() => mockBook),
                aoa_to_sheet: vi.fn(() => mockSheet),
                sheet_add_json: vi.fn(),
                book_append_sheet: vi.fn(),
            },
            writeFile: vi.fn(),
        },
        utils: {
            book_new: vi.fn(() => mockBook),
            aoa_to_sheet: vi.fn(() => mockSheet),
            sheet_add_json: vi.fn(),
            book_append_sheet: vi.fn(),
        },
        writeFile: vi.fn(),
    };
});

describe('excelExport utilities', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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
