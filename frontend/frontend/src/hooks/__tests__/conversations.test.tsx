import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConversationsPanel } from '../../components/common/messaging/ConversationsPanel';

const mocks = vi.hoisted(() => ({ list: vi.fn(), thread: vi.fn(), read: vi.fn() }));
vi.mock('react-i18next', async (importOriginal) => ({
  ...await importOriginal<typeof import('react-i18next')>(),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('goey-toast', () => ({ gooeyToast: { error: vi.fn() } }));
vi.mock('../../services/communicationService', () => ({ default: { getConversations: mocks.list, getConversation: mocks.thread, markConversationRead: mocks.read } }));
vi.mock('../../components/common/messaging/MessageComposer', () => ({ MessageComposer: ({ fixedRecipient }: { fixedRecipient: number }) => <div data-testid="reply-recipient">{fixedRecipient}</div> }));

const message = { id: 32, sender: 2, sender_name: 'Alice', recipient: 1, recipient_name: 'Bob', content: 'Latest message', is_read: false, created_at: '2026-11-13T10:00:00Z' };
const clients: QueryClient[] = [];
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><ConversationsPanel currentUser={{ id: 1, username: 'Bob' }} onZoomAttachment={vi.fn()} /></QueryClientProvider>);
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.list.mockResolvedValue({ data: { count: 1, next: null, results: [{ peer_id: 2, peer_name: 'Alice', last_content: 'Preview', last_created_at: message.created_at, unread_count: 1 }] } });
  mocks.thread.mockImplementation((_peer: number, before?: number) => Promise.resolve({ data: { results: before ? [{ ...message, id: 1, content: 'Older message', is_read: true }] : [message], next_before: before ? null : 32 } }));
  mocks.read.mockResolvedValue({});
});
afterEach(() => { cleanup(); clients.forEach((client) => client.clear()); clients.length = 0; });

describe('conversations', () => {
  it('opens a private thread, marks received messages read and fixes the reply recipient', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /Alice/ }));
    expect(await screen.findByText('Latest message')).toBeInTheDocument();
    expect(screen.getByTestId('reply-recipient')).toHaveTextContent('2');
    await waitFor(() => expect(mocks.read).toHaveBeenCalledWith(2, [32]));
  });

  it('loads older messages on demand using the cursor without losing the latest message', async () => {
    setup();
    fireEvent.click(await screen.findByRole('button', { name: /Alice/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'conversations.load_older' }));
    expect(await screen.findByText('Older message')).toBeInTheDocument();
    expect(screen.getByText('Latest message')).toBeInTheDocument();
    expect(mocks.thread).toHaveBeenCalledWith(2, 32);
  });
});
