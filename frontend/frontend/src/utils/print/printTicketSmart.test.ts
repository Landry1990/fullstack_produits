import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PharmacySettings, TicketCaisse } from '../../types';
import { buildTicketEscpos } from '../escpos/ticketEscpos';
import { printEscpos } from '../../services/qzPrinter';
import { printTicketSmart } from './printTicketSmart';

vi.mock('../escpos/ticketEscpos', () => ({ buildTicketEscpos: vi.fn() }));
vi.mock('../../services/qzPrinter', () => ({
  printEscpos: vi.fn(), shouldOpenDrawer: () => true,
}));

const ticket = {} as TicketCaisse;
const settings = {} as PharmacySettings;

describe('printTicketSmart copies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(buildTicketEscpos).mockReturnValue('ticket');
    vi.mocked(printEscpos).mockResolvedValue(true);
  });

  it('prints one copy by default', async () => {
    await printTicketSmart(ticket, settings, vi.fn());
    expect(buildTicketEscpos).toHaveBeenCalledTimes(1);
    expect(printEscpos).toHaveBeenCalledWith('ticket');
  });

  it('submits both copies in one job and opens the drawer only on the first', async () => {
    await printTicketSmart(ticket, settings, vi.fn(), 2);
    expect(buildTicketEscpos).toHaveBeenNthCalledWith(1, ticket, settings, { openDrawer: true });
    expect(buildTicketEscpos).toHaveBeenNthCalledWith(2, ticket, settings, { openDrawer: false });
    expect(printEscpos).toHaveBeenCalledTimes(1);
    expect(printEscpos).toHaveBeenCalledWith('ticketticket');
  });

  it('invokes the HTML fallback once when QZ is unavailable', async () => {
    vi.mocked(printEscpos).mockResolvedValue(false);
    const fallback = vi.fn();
    expect(await printTicketSmart(ticket, settings, fallback, 2)).toBe('html');
    expect(fallback).toHaveBeenCalledTimes(1);
  });
});
