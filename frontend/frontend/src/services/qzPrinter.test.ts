import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ active: true }));
const qz = vi.hoisted(() => ({
  websocket: {
    isActive: vi.fn(() => state.active),
    connect: vi.fn(async () => { state.active = true; }),
    disconnect: vi.fn(async () => { state.active = false; }),
    setClosedCallbacks: vi.fn(),
    setErrorCallbacks: vi.fn(),
  },
  printers: { find: vi.fn(), getDefault: vi.fn() },
  configs: { create: vi.fn((name: string) => ({ printer: name })) },
  print: vi.fn(),
  security: {
    setSignatureAlgorithm: vi.fn(), setCertificatePromise: vi.fn(), setSignaturePromise: vi.fn(),
  },
}));

vi.mock('qz-tray', () => ({ default: qz }));
vi.mock('../utils/storage', () => ({ safeStorage: { getItem: vi.fn() } }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  state.active = true;
  localStorage.clear();
  localStorage.setItem('qz_printer_name', 'POS-80-Series');
  qz.printers.find.mockReset().mockResolvedValue(['POS-80-Series', 'Zebra']);
  qz.printers.getDefault.mockReset().mockResolvedValue('Office printer');
  qz.print.mockReset().mockResolvedValue(undefined);
});

afterEach(() => { vi.useRealTimers(); });

describe('QZ automatic printer recovery', () => {
  it('refreshes the full printer list and uses the exact saved name', async () => {
    const { printEscpos } = await import('./qzPrinter');
    expect(await printEscpos('ticket')).toBe(true);
    expect(qz.printers.find).toHaveBeenCalledWith();
    expect(qz.configs.create).toHaveBeenCalledWith('POS-80-Series');
    expect(qz.print).toHaveBeenCalledTimes(1);
  });

  it('reconnects automatically when discovery fails on a stale connection', async () => {
    qz.printers.find.mockRejectedValueOnce(new Error('stale socket'));
    const { printEscpos } = await import('./qzPrinter');
    expect(await printEscpos('ticket')).toBe(true);
    expect(qz.websocket.disconnect).toHaveBeenCalledTimes(1);
    expect(qz.websocket.connect).toHaveBeenCalledTimes(1);
    expect(qz.print).toHaveBeenCalledTimes(1);
  });

  it('rediscovers a missing printer once before sending the job', async () => {
    qz.printers.find.mockResolvedValueOnce([]);
    const { printEscpos } = await import('./qzPrinter');
    expect(await printEscpos('ticket')).toBe(true);
    expect(qz.printers.find).toHaveBeenCalledTimes(2);
    expect(qz.print).toHaveBeenCalledTimes(1);
  });

  it('never silently switches to another printer when the saved one is missing', async () => {
    qz.printers.find.mockResolvedValue(['Office printer']);
    const { printEscpos } = await import('./qzPrinter');
    expect(await printEscpos('ticket')).toBe(false);
    expect(qz.printers.getDefault).not.toHaveBeenCalled();
    expect(qz.print).not.toHaveBeenCalled();
    expect(localStorage.getItem('qz_printer_name')).toBe('POS-80-Series');
    expect(qz.websocket.connect).toHaveBeenCalledTimes(1);
  });

  it('keeps the dedicated label printer during recovery', async () => {
    qz.printers.find.mockRejectedValueOnce(new Error('stale socket'));
    const { printEscpos } = await import('./qzPrinter');
    expect(await printEscpos('label', 'Zebra')).toBe(true);
    expect(qz.configs.create).toHaveBeenCalledWith('Zebra');
    expect(qz.print).toHaveBeenCalledTimes(1);
  });

  it('does not retry a job after submission fails with an uncertain outcome', async () => {
    qz.print.mockRejectedValue(new Error('socket lost after submission'));
    const { printEscpos } = await import('./qzPrinter');
    await expect(printEscpos('ticket')).rejects.toThrow('socket lost after submission');
    expect(qz.print).toHaveBeenCalledTimes(1);
    expect(qz.websocket.disconnect).not.toHaveBeenCalled();
  });

  it('waits for an active print job before refreshing the printer list', async () => {
    let finishPrint!: () => void;
    qz.print.mockImplementationOnce(() => new Promise<void>(resolve => { finishPrint = resolve; }));
    const { printEscpos, listPrinters } = await import('./qzPrinter');
    const printing = printEscpos('ticket');
    await vi.dynamicImportSettled();
    const detecting = listPrinters();
    await vi.dynamicImportSettled();
    expect(qz.printers.find).toHaveBeenCalledTimes(1);
    finishPrint();
    await printing;
    expect(await detecting).toEqual(['POS-80-Series', 'Zebra']);
    expect(qz.printers.find).toHaveBeenCalledTimes(2);
  });

  it('uses the system default only when no printer has been configured', async () => {
    localStorage.removeItem('qz_printer_name');
    const { printEscpos } = await import('./qzPrinter');
    expect(await printEscpos('ticket')).toBe(true);
    expect(qz.configs.create).toHaveBeenCalledWith('Office printer');
  });

  it('bounds discovery waiting and recovers before printing', async () => {
    vi.useFakeTimers();
    qz.printers.find.mockImplementationOnce(() => new Promise(() => {}));
    const { printEscpos } = await import('./qzPrinter');
    const result = printEscpos('ticket');
    await vi.dynamicImportSettled();
    await vi.advanceTimersByTimeAsync(5001);
    expect(await result).toBe(true);
    expect(qz.websocket.connect).toHaveBeenCalledTimes(1);
    expect(qz.print).toHaveBeenCalledTimes(1);
  });
});
