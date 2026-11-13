import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useDebounce } from 'use-debounce';
import { ArrowLeft, MessageSquare, RefreshCw } from 'lucide-react';
import { gooeyToast } from 'goey-toast';
import communicationService, { type ConversationPage, type ConversationSummary } from '../../../services/communicationService';
import { formatDateTime } from '../../../utils/dateUtils';
import { Button } from '../../shadcn/button';
import { Input } from '../../shadcn/input';
import { Badge } from '../../shadcn/badge';
import { AttachmentThumb } from './AttachmentLightbox';
import { MessageComposer } from './MessageComposer';
import { composerReducer, initialComposerState, type MessagingUser } from './types';

interface ConversationsPanelProps {
  currentUser: MessagingUser;
  onZoomAttachment: (url: string) => void;
  initialPeer?: ConversationSummary | null;
}

function ConversationThread({ peer, currentUser, onZoomAttachment, onBack }: ConversationsPanelProps & { peer: ConversationSummary; onBack: () => void }) {
  const { t } = useTranslation(['messaging', 'common']);
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(composerReducer, initialComposerState);
  const [visible, setVisible] = useState(document.visibilityState === 'visible');
  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === 'visible');
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  const latest = useQuery({
    queryKey: ['internalMessages', 'thread', currentUser.id, peer.peer_id],
    queryFn: async () => (await communicationService.getConversation(peer.peer_id)).data,
    refetchInterval: 3000,
  });
  const older = useInfiniteQuery({
    queryKey: ['internalMessages', 'threadOlder', currentUser.id, peer.peer_id],
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) => (await communicationService.getConversation(peer.peer_id, pageParam ?? latest.data?.next_before ?? undefined)).data,
    getNextPageParam: (page) => page.next_before ?? undefined,
    enabled: false,
    gcTime: 0,
  });
  const messages = useMemo(() => {
    const unique = new Map([...older.data?.pages.flatMap((page) => page.results) ?? [], ...latest.data?.results ?? []].map((message) => [message.id, message]));
    return [...unique.values()].sort((a, b) => a.id - b.id);
  }, [latest.data, older.data]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const lastId = messages.at(-1)?.id;
  useLayoutEffect(() => {
    if (scrollRef.current && atBottom.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [lastId]);
  const unreadIds = messages.filter((message) => message.sender !== currentUser.id && !message.is_read).slice(0, 30).map((message) => message.id).join(',');
  useEffect(() => {
    if (!visible || !unreadIds) return;
    const ids = unreadIds.split(',').map(Number);
    let active = true;
    communicationService.markConversationRead(peer.peer_id, ids).then(() => {
      if (!active) return;
      const markPage = (page: ConversationPage): ConversationPage => ({ ...page, results: page.results.map((message) => ids.includes(message.id) ? { ...message, is_read: true } : message) });
      queryClient.setQueryData<ConversationPage>(['internalMessages', 'thread', currentUser.id, peer.peer_id], (page) => page ? markPage(page) : page);
      queryClient.setQueryData<InfiniteData<ConversationPage>>(['internalMessages', 'threadOlder', currentUser.id, peer.peer_id], (data) => data ? { ...data, pages: data.pages.map(markPage) } : data);
      void queryClient.invalidateQueries({ queryKey: ['internalMessages'] });
    }).catch(() => { if (active) gooeyToast.error(t('common:error')); });
    return () => { active = false; };
  }, [peer.peer_id, unreadIds, queryClient, visible, t, currentUser.id]);
  const canLoadOlder = older.data ? older.hasNextPage : latest.data?.next_before != null;

  return (
    <section className="flex-1 min-w-0 min-h-0 flex flex-col" aria-label={t('conversations.thread', { name: peer.peer_name })}>
      <div className="flex items-center gap-2 border-b border-slate-200 p-3">
        <Button variant="ghost" size="sm" onClick={onBack} aria-label={t('detail.back')}><ArrowLeft size={16} /></Button>
        <h4 className="font-semibold truncate">{peer.peer_name}</h4>
      </div>
      <div ref={scrollRef} onScroll={(event) => { const node = event.currentTarget; atBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80; }} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {canLoadOlder && <Button variant="outline" size="sm" disabled={older.isFetching} onClick={() => void older.fetchNextPage()}>{t('conversations.load_older')}</Button>}
        {(latest.isError || older.isError) && <Button variant="outline" onClick={() => { void latest.refetch(); if (older.isError) void older.refetch(); }}><RefreshCw size={14} />{t('retry')}</Button>}
        {latest.isLoading && <p role="status">{t('common:loading')}</p>}
        {messages.map((message) => (
          <article key={message.id} className={`rounded-xl p-3 max-w-[90%] sm:max-w-[80%] ${message.sender === currentUser.id ? 'ml-auto bg-emerald-50 border border-emerald-200' : 'mr-auto bg-slate-100 border border-slate-200'}`}>
            <p className="whitespace-pre-wrap break-words text-sm">{message.content}</p>
            <AttachmentThumb message={message} onZoom={onZoomAttachment} />
            <div className="mt-2 text-xs text-slate-500 flex flex-wrap justify-end gap-2">
              <time>{formatDateTime(message.created_at)}</time>
              {message.sender === currentUser.id && <span>{t(message.read_by?.includes(peer.peer_id) ? 'read' : 'unread')}</span>}
            </div>
          </article>
        ))}
      </div>
      <MessageComposer fixedRecipient={peer.peer_id} users={[]} isAdmin={false} state={state} dispatch={dispatch} onCancel={() => dispatch({ type: 'RESET' })} onSent={() => { void latest.refetch(); }} />
    </section>
  );
}

export function ConversationsPanel({ currentUser, onZoomAttachment, initialPeer }: ConversationsPanelProps) {
  const { t } = useTranslation(['messaging', 'common']);
  const [peer, setPeer] = useState<ConversationSummary | null>(initialPeer ?? null);
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ['internalMessages', 'conversations', currentUser.id, page, debouncedSearch],
    queryFn: async () => (await communicationService.getConversations(page, debouncedSearch)).data,
    refetchInterval: 3000,
  });
  return (
    <div className="flex flex-1 min-w-0 min-h-0 overflow-hidden">
      <aside className={`w-full md:w-64 lg:w-72 shrink-0 border-r border-slate-200 p-3 overflow-y-auto ${peer ? 'hidden md:block' : ''}`}>
        <h4 className="font-semibold mb-3">{t('conversations.title')}</h4>
        <Input aria-label={t('search_placeholder')} placeholder={t('search_placeholder')} value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} />
        <p className="text-xs text-slate-500 my-3">{t('conversations.broadcast_help')}</p>
        {list.isLoading && <p role="status">{t('common:loading')}</p>}
        {list.isError && <Button variant="outline" onClick={() => void list.refetch()}>{t('retry')}</Button>}
        {list.data?.results.length === 0 && <p className="text-sm text-slate-600">{t('conversations.empty')}</p>}
        <div className="space-y-2">
          {list.data?.results.map((conversation) => (
            <button key={conversation.peer_id} type="button" onClick={() => setPeer(conversation)} aria-current={peer?.peer_id === conversation.peer_id ? 'true' : undefined} className={`w-full text-left p-3 rounded-xl border cursor-pointer transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 ${peer?.peer_id === conversation.peer_id ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <div className="flex items-center gap-2"><span className="font-semibold truncate flex-1">{conversation.peer_name}</span>{conversation.unread_count > 0 && <Badge variant="destructive">{conversation.unread_count}</Badge>}</div>
              <p className="text-xs truncate text-slate-600 mt-1">{conversation.last_content}</p>
              <time className="text-xs text-slate-500">{formatDateTime(conversation.last_created_at)}</time>
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-3">
          {page > 1 && <Button size="sm" variant="outline" disabled={list.isFetching} onClick={() => setPage(page - 1)}>{t('conversations.previous')}</Button>}
          {list.data?.next && <Button size="sm" variant="outline" disabled={list.isFetching} onClick={() => setPage(page + 1)}>{t('conversations.next')}</Button>}
        </div>
      </aside>
      {peer ? <ConversationThread key={peer.peer_id} peer={peer} currentUser={currentUser} onZoomAttachment={onZoomAttachment} onBack={() => setPeer(null)} /> : <div className="hidden md:flex flex-1 flex-col items-center justify-center gap-3 text-slate-500 p-6"><MessageSquare size={28} /><p>{t('conversations.select')}</p></div>}
    </div>
  );
}
