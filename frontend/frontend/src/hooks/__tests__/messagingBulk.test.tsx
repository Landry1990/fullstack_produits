import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MessagingCenter } from '../../components/common/messaging/MessagingCenter';

const mocks = vi.hoisted(() => ({
  archive: vi.fn(), delete: vi.fn(), confirm: vi.fn(),
  messages: [1, 2].map((id) => ({ id, sender: 3, sender_name: 'Alice', recipient: 1, recipient_name: 'Bob', content: `Message ${id}`, is_read: true, created_at: '2026-11-13T10:00:00Z' })),
}));
vi.mock('react-i18next', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-i18next')>(),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('goey-toast', () => ({ gooeyToast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('../../hooks/useConfirm', () => ({ useConfirm: () => mocks.confirm }));
vi.mock('../../services/communicationService', () => ({ default: { archiveMessage: mocks.archive, deleteMessage: mocks.delete } }));
vi.mock('../../components/common/messaging/useMessaging', () => ({
  DEFAULT_PAGE_SIZE: 20,
  useMessaging: () => ({ messages: mocks.messages, totalCount: 2, totalPages: 1, templates: [], users: [], isLoading: false, isFetching: false, error: null, refetch: vi.fn() }),
  useUnreadMessageCount: () => ({ data: 0 }),
  useSupervisionMessageCount: () => ({ data: 2 }),
  useMarkAsReadMutation: () => ({ mutateAsync: vi.fn() }),
  useArchiveMessageMutation: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock('../../components/common/messaging/ConversationsPanel', () => ({ ConversationsPanel: () => null }));
vi.mock('../../components/common/messaging/MessageComposer', () => ({ MessageComposer: () => null }));
vi.mock('../../components/common/messaging/TemplatesPanel', () => ({ TemplatesPanel: () => null }));

function setup(admin = false) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MessagingCenter currentUser={{ id: 1, username: 'Bob', is_staff: admin }} isOpen /></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'tabs.received' }));
  fireEvent.click(screen.getByText('bulk.select_page'));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.archive.mockResolvedValue({});
  mocks.delete.mockResolvedValue({});
  mocks.confirm.mockResolvedValue(true);
});
afterEach(cleanup);

describe('messaging bulk actions', () => {
  it('archives selected messages without allowing a normal user to delete', async () => {
    setup();
    expect(screen.queryByRole('button', { name: 'bulk.delete' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'actions.archive' }));
    await waitFor(() => expect(mocks.archive).toHaveBeenCalledTimes(2));
    expect(mocks.archive.mock.calls).toEqual([[1], [2]]);
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it('clears the actionable selection when the search changes', () => {
    setup();
    fireEvent.change(screen.getByPlaceholderText('search_placeholder'), { target: { value: 'other' } });
    expect(screen.getByRole('button', { name: 'actions.archive' })).toBeDisabled();
  });

  it('does not delete if the administrator cancels confirmation', async () => {
    mocks.confirm.mockResolvedValue(false);
    setup(true);
    fireEvent.click(screen.getByRole('button', { name: 'bulk.delete' }));
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalled());
    expect(mocks.delete).not.toHaveBeenCalled();
  });

  it('deletes selected messages after administrator confirmation', async () => {
    setup(true);
    fireEvent.click(screen.getByRole('button', { name: 'bulk.delete' }));
    await waitFor(() => expect(mocks.delete).toHaveBeenCalledTimes(2));
    expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ variant: 'danger' }));
  });

  it('keeps only failed messages selected for a retry', async () => {
    mocks.archive.mockRejectedValueOnce(new Error('network')).mockResolvedValue({});
    setup();
    fireEvent.click(screen.getByRole('button', { name: 'actions.archive' }));
    await waitFor(() => expect(screen.getAllByRole('checkbox', { checked: true })).toHaveLength(1));
    mocks.archive.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'actions.archive' }));
    await waitFor(() => expect(mocks.archive).toHaveBeenCalledWith(1));
    expect(mocks.archive).toHaveBeenCalledTimes(1);
  });
});
