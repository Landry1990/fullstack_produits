import { useMemo, useReducer, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDebounce } from 'use-debounce';
import { Search } from 'lucide-react';
import type { InternalMessage } from '../../../services/communicationService';
import { AttachmentLightbox } from './AttachmentLightbox';
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
import { Input } from '../../ui/Input';
import { Checkbox } from '../../ui/Checkbox';
import Pagination from '../../ui/Pagination';
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
  const myId = currentUser?.id ?? null;

  const [activeTab, setActiveTab] = useState<MessagingTab>('received');
  const [selectedId, setSelectedId] = useState<number | null>(null);
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

  const listVariant: MessageListVariant = activeTab === 'supervision' ? 'supervision' : activeTab;

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
    setActiveTab('sent');
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
                  <Input
                    value={searchInput}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder={t('search_placeholder')}
                    icon={<Search size={16} aria-hidden />}
                    size="sm"
                  />
                  <div className="flex flex-wrap items-center gap-3 px-1">
                    <Checkbox
                      checked={hasAttachment}
                      onChange={handleHasAttachmentChange}
                      label={t('filter_attachment')}
                      size="sm"
                      color="primary"
                    />
                    {activeTab === 'received' && (
                      <Checkbox
                        checked={unreadOnly}
                        onChange={handleUnreadOnlyChange}
                        label={t('filter_unread')}
                        size="sm"
                        color="error"
                      />
                    )}
                  </div>
                </div>
              )}

              <MessageList
                messages={messages}
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
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={totalCount}
                    onPrev={() => setPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                    hasNext={page < totalPages}
                    isLoading={isFetching}
                    label={t('messages_label')}
                    className="border-0 p-0 bg-transparent"
                  />
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
