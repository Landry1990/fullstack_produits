import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useUnreadMessageCount } from '../../components/common/messaging/useMessaging';
import communicationService from '../../services/communicationService';

vi.mock('../../services/communicationService', () => ({
  default: { getUnreadCount: vi.fn() },
}));

vi.mock('goey-toast', () => ({ gooeyToast: { success: vi.fn(), error: vi.fn() } }));

const clients: QueryClient[] = [];

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

afterEach(() => {
  cleanup();
  clients.forEach((client) => client.clear());
  clients.length = 0;
  focusManager.setFocused(undefined);
  vi.useRealTimers();
  vi.resetAllMocks();
});

describe('useUnreadMessageCount', () => {
  it.each([true, false])('detects new messages within 3 seconds (focused: %s)', async (focused) => {
    vi.useFakeTimers();
    focusManager.setFocused(focused);
    vi.mocked(communicationService.getUnreadCount)
      .mockResolvedValueOnce({ data: { count: 0 } } as Awaited<ReturnType<typeof communicationService.getUnreadCount>>)
      .mockResolvedValue({ data: { count: 1 } } as Awaited<ReturnType<typeof communicationService.getUnreadCount>>);

    const { result } = renderHook(() => useUnreadMessageCount(true), { wrapper });
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(result.current.data).toBe(0);

    await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
    expect(communicationService.getUnreadCount).toHaveBeenCalledTimes(2);
    expect(result.current.data).toBe(1);
  });

  it('does not poll without an authenticated user', async () => {
    vi.useFakeTimers();
    renderHook(() => useUnreadMessageCount(false), { wrapper });
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(communicationService.getUnreadCount).not.toHaveBeenCalled();
  });
});
