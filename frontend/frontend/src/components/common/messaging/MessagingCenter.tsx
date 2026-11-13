import { useMemo, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from 'use-debounce';
import { Archive, Search, Trash2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { gooeyToast } from 'goey-toast';
import communicationService, { type ConversationSummary, type InternalMessage } from '../../../services/communicationService';
import { useConfirm } from '../../../hooks/useConfirm';
import { Button } from '../../shadcn/button';
import { AttachmentLightbox } from './AttachmentLightbox';
import { ConversationsPanel } from './ConversationsPanel';
import { MessageComposer } from './MessageComposer';
import { MessageDetail } from './MessageDetail';
import { MessageList, type MessageListVariant } from './MessageList';
import { MessagingNav } from './MessagingNav';
import { TemplatesPanel } from './TemplatesPanel';
import {
  DEFAULT_PAGE_SIZE,
  useArchiveMessageMutation,
  useMarkAsReadMutation,
  useMessaging,
  useSupervisionMessageCount,
  useUnreadMessageCount,
} from './useMessaging';
import { Input } from '../../shadcn/input';
import { Checkbox } from '../../shadcn/checkbox';
import PaginationControls from '../../ui/PaginationControls';
import {
  composerReducer,
  initialComposerState,
  type MessagingTab,
  type MessagingUser,
} from './types';

interface MessagingCenterProps {
  currentUser: MessagingUser;
  isOpen: boolean;
  onMessageRead?: () => void;
}

const LIST_TABS: MessagingTab[] = ['received', 'sent', 'archived', 'supervision'];

function tabToBox(tab: MessagingTab): 'received' | 'sent' | 'archived' | 'all' | null {
  switch (tab) {
    case 'received':
      return 'received';
    case 'sent':
      return 'sent';
    case 'archived':
      return 'archived';
    case 'supervision':
      return 'all';
    default:
      return null;
  }
}

export function MessagingCenter({ currentUser, isOpen, onMessageRead }: MessagingCenterProps) {
  const { t } = useTranslation(['messaging', 'common']);
  const isAdmin = Boolean(currentUser?.is_staff || currentUser?.is_superuser);

  const [activeTab, setActiveTab] = useState<MessagingTab>('conversations');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [conversationPeer, setConversationPeer] = useState<ConversationSummary | null>(null);
  const [composerState, dispatchComposer] = useReducer(composerReducer, initialComposerState);

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch] = useDebounce(searchInput, 300);
  const [hasAttachment, setHasAttachment] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);

  const activeBox = tabToBox(activeTab);

  const filters = useMemo(
    () => ({
      box: activeBox,
      page,
      page_size: DEFAULT_PAGE_SIZE,
      search: debouncedSearch,
      has_attachment: hasAttachment,
      unread: unreadOnly,
    }),
    [activeBox, page, debouncedSearch, hasAttachment, unreadOnly],
  );

  const { messages, totalCount, totalPages, templates, users, isLoading, isFetching, error, refetch } = useMessaging({
    enabled: isOpen,
    currentUser,
    filters,
  });

  const { data: unreadCount = 0 } = useUnreadMessageCount(isOpen);
  const { data: supervisionCount = 0 } = useSupervisionMessageCount(isOpen && isAdmin);

  const markAsReadMutation = useMarkAsReadMutation();
  const archiveMutation = useArchiveMessageMutation();
  const [actionBusy, setActionBusy] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<{ scope: string; ids: number[] }>({ scope: '', ids: [] });
  const selectionScope = JSON.stringify([filters, searchInput, isOpen, currentUser.id]);
  const checkedIds = selection.scope === selectionScope
    ? selection.ids.filter((id) => messages.some((message) => message.id === id))
    : [];
  const toggleChecked = (id: number) => {
    setSelection({ scope: selectionScope, ids: checkedIds.includes(id) ? checkedIds.filter((value) => value !== id) : [...checkedIds, id] });
  };

  const handleBulkAction = async (operation: 'archive' | 'delete') => {
    if (actionBusy || checkedIds.length === 0 || (operation === 'delete' && !isAdmin)) return;
    const ids = [...checkedIds];
    setActionBusy(true);
    try {
      if (operation === 'delete' && !await confirm({
        title: t('bulk.delete'),
        message: t('bulk.delete_confirm', { count: ids.length }),
        confirmText: t('bulk.delete'),
        variant: 'danger',
      })) return;
      const failed: number[] = [];
      for (const id of ids) {
        try {
          if (operation === 'delete') await communicationService.deleteMessage(id);
          else await communicationService.archiveMessage(id);
        } catch {
          failed.push(id);
        }
      }
      setSelection({ scope: selectionScope, ids: failed });
      setSelectedId(null);
      if (failed.length) gooeyToast.error(t('bulk.partial_error', { count: failed.length }));
      if (failed.length < ids.length) gooeyToast.success(t(operation === 'delete' ? 'bulk.deleted' : 'bulk.archived', { count: ids.length - failed.length }));
      await queryClient.invalidateQueries({ queryKey: ['internalMessages'] });
      onMessageRead?.();
    } finally {
      setActionBusy(false);
    }
  };

  const listVariant: MessageListVariant = activeTab === 'sent' || activeTab === 'archived' || activeTab === 'supervision' ? activeTab : 'received';

  const selectedMessage = useMemo(() => {
    if (selectedId === null) return null;
    return messages.find((m) => m.id === selectedId) ?? null;
  }, [selectedId, messages]);

  const resetFilters = () => {
    setSearchInput('');
    setHasAttachment(false);
    setUnreadOnly(false);
    setPage(1);
  };

  const handleTabChange = (tab: MessagingTab) => {
    setActiveTab(tab);
    resetFilters();
    if (tab !== 'new') setSelectedId(null);
    if (tab === 'new') dispatchComposer({ type: 'SET_REPLY_TO', payload: null });
  };

  const handleSearchChange = (value: string) => {
    setSearchInput(value);
    setSelectedId(null);
    setPage(1);
  };

  const handleHasAttachmentChange = (checked: boolean) => {
    setHasAttachment(checked);
    setSelectedId(null);
    setPage(1);
  };

  const handleUnreadOnlyChange = (checked: boolean) => {
    setUnreadOnly(checked);
    setSelectedId(null);
    setPage(1);
  };

  const handleSelectMessage = async (m: InternalMessage) => {
    setSelectedId(m.id);
    if (listVariant === 'received' && !m.is_read) {
      try {
        await markAsReadMutation.mutateAsync(m.id);
        onMessageRead?.();
      } catch {
        return;
      }
    }
  };

  const handleArchive = async (m: InternalMessage) => {
    if (actionBusy) return;
    setActionBusy(true);
    try {
      await archiveMutation.mutateAsync(m.id);
      setSelectedId(null);
    } catch {
      return;
    } finally {
      setActionBusy(false);
    }
  };

  const handleReply = (m: InternalMessage) => {
    dispatchComposer({ type: 'SET_REPLY_TO', payload: m, recipientId: m.sender });
    setSelectedId(null);
    setActiveTab('new');
  };

  const handleSent = () => {
    const recipient = users.find((user) => user.id === composerState.recipientId);
    if (!recipient) {
      setActiveTab('sent');
      return;
    }
    setConversationPeer({ peer_id: recipient.id, peer_name: recipient.username, last_content: '', last_created_at: new Date().toISOString(), unread_count: 0 });
    setActiveTab('conversations');
  };

  const handleApplyTemplate = (content: string) => {
    dispatchComposer({ type: 'SET_CONTENT', payload: content });
    setActiveTab('new');
  };

  const showDetailPane = LIST_TABS.includes(activeTab);
  const mobileShowDetail = showDetailPane && selectedMessage !== null;

  const filtersVisible = activeTab === 'received' || activeTab === 'sent' || activeTab === 'archived' || activeTab === 'supervision';

  return (
    <div
      className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden bg-white"
      style={{ minHeight: '420px' }}
    >
      <MessagingNav
        activeTab={activeTab}
        onTabChange={handleTabChange}
        unreadCount={unreadCount}
        supervisionCount={supervisionCount}
        isAdmin={isAdmin}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {activeTab === 'conversations' && isOpen && <ConversationsPanel currentUser={currentUser} onZoomAttachment={setZoomImage} initialPeer={conversationPeer} />}
        {showDetailPane && (
          <>
            <div
              className={`w-full md:w-72 lg:w-80 shrink-0 md:border-r border-slate-200 overflow-y-auto p-3 ${
                mobileShowDetail ? 'hidden md:block' : ''
              }`}
            >
              <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 px-1">
                {activeTab === 'received' && t('received.title')}
                {activeTab === 'sent' && t('sent.title')}
                {activeTab === 'archived' && t('archived_messages')}
                {activeTab === 'supervision' && t('supervision.title')}
              </h4>

              {filtersVisible && (
                <div className="space-y-2 mb-3">
                  <div className="relative group">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 group-focus-within:text-emerald-500 transition-colors">
                      <Search size={16} aria-hidden />
                    </span>
                    <Input
                      value={searchInput}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder={t('search_placeholder')}
                      className="h-9 text-xs pl-10"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 px-1">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={hasAttachment}
                        onCheckedChange={(v) => handleHasAttachmentChange(v === true)}
                      />
                      <label className="text-sm font-medium select-none text-slate-600 dark:text-slate-300">
                        {t('filter_attachment')}
                      </label>
                    </div>
                    {activeTab === 'received' && (
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={unreadOnly}
                          onCheckedChange={(v) => handleUnreadOnlyChange(v === true)}
                        />
                        <label className="text-sm font-medium select-none text-slate-600 dark:text-slate-300">
                          {t('filter_unread')}
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(activeTab === 'received' || isAdmin) && messages.length > 0 && (
                <div className="mb-3 space-y-2 rounded-lg border border-slate-200 p-2">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={checkedIds.length === messages.length ? true : checkedIds.length > 0 ? 'indeterminate' : false}
                      disabled={actionBusy}
                      onCheckedChange={(checked) => setSelection({ scope: selectionScope, ids: checked === true ? messages.map((message) => message.id) : [] })}
                    />
                    {t('bulk.select_page')}
                  </label>
                  <p className="text-xs text-slate-600" aria-live="polite">{t('bulk.selected', { count: checkedIds.length })}</p>
                  <div className="flex flex-wrap gap-2">
                    {activeTab === 'received' && (
                      <Button size="sm" variant="outline" disabled={actionBusy || checkedIds.length === 0} onClick={() => void handleBulkAction('archive')}>
                        <Archive size={14} aria-hidden />{t('actions.archive')}
                      </Button>
                    )}
                    {isAdmin && (
                      <Button size="sm" variant="destructive" disabled={actionBusy || checkedIds.length === 0} onClick={() => void handleBulkAction('delete')}>
                        <Trash2 size={14} aria-hidden />{t('bulk.delete')}
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <MessageList
                messages={messages}
                checkedIds={checkedIds}
                onToggleChecked={activeTab === 'received' || isAdmin ? toggleChecked : undefined}
                selectionDisabled={actionBusy}
                variant={listVariant}
                loading={isLoading}
                isFetching={isFetching}
                selectedId={selectedId}
                onSelect={handleSelectMessage}
                error={error}
                onRetry={refetch}
              />

              {totalPages > 1 && (
                <div className="mt-3 pt-3 border-t border-slate-200">
                  <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white/50 dark:bg-slate-900/50 border-0 p-0 bg-transparent">
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {t('common:pagination_info', {
                        page,
                        total: totalPages,
                        count: totalCount,
                        label: t('messages_label') || t('common:items', { count: totalCount })
                      })}
                    </div>
                    <PaginationControls
                      page={page}
                      totalPages={totalPages}
                      onPageChange={setPage}
                      isLoading={isFetching}
                    />
                  </div>
                </div>
              )}

              {activeTab === 'supervision' && (
                <div className="mt-3 px-1 text-xs text-slate-500">
                  {t('supervision.total', { count: totalCount })}
                </div>
              )}
            </div>

            <MessageDetail
              message={selectedMessage}
              variant={listVariant}
              onBack={() => setSelectedId(null)}
              onReply={listVariant === 'received' ? handleReply : undefined}
              onArchive={listVariant === 'received' ? handleArchive : undefined}
              onZoomAttachment={setZoomImage}
              actionBusy={actionBusy}
            />
          </>
        )}

        {activeTab === 'templates' && (
          <TemplatesPanel templates={templates} loading={isLoading} isAdmin={isAdmin} onApply={handleApplyTemplate} />
        )}

        {activeTab === 'new' && (
          <div className="flex-1 min-w-0 overflow-y-auto">
            <MessageComposer
              users={users}
              isAdmin={isAdmin}
              state={composerState}
              dispatch={dispatchComposer}
              onCancel={() => handleTabChange('received')}
              onSent={handleSent}
            />
          </div>
        )}
      </div>

      <AttachmentLightbox url={zoomImage} onClose={() => setZoomImage(null)} />
    </div>
  );
}
