import { Archive, Check, CheckCheck, Clock, MessageSquare, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Skeleton } from '../../ui/Skeleton';
import { formatDateTime } from '../../../utils/dateUtils';
import type { InternalMessage } from '../../../services/communicationService';

export type MessageListVariant = 'received' | 'sent' | 'archived' | 'supervision';

interface MessageRowProps {
  message: InternalMessage;
  variant: MessageListVariant;
  selected: boolean;
  onSelect: (message: InternalMessage) => void;
}

export function MessageRow({ message: m, variant, selected, onSelect }: MessageRowProps) {
  const { t } = useTranslation('messaging');
  const unread = variant === 'received' && !m.is_read;

  return (
    <button
      type="button"
      onClick={() => onSelect(m)}
      aria-current={selected ? 'true' : undefined}
      aria-label={`${m.sender_name} — ${formatDateTime(m.created_at)}`}
      className={`w-full text-left p-3 rounded-xl border transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        selected
          ? 'bg-blue-100 border-blue-400'
          : unread
            ? 'bg-blue-50 border-indigo-200'
            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          aria-hidden
          className={`size-9 rounded-full flex items-center justify-center font-bold text-xs uppercase shrink-0 ${
            variant === 'supervision'
              ? 'bg-amber-100 text-amber-600'
              : unread
                ? 'bg-blue-600 text-white'
                : 'bg-gray-300 text-slate-700'
          }`}
        >
          {m.sender_name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className={`font-semibold text-sm truncate ${unread ? 'text-slate-900' : 'text-slate-700'}`}>
              {variant === 'sent' ? m.recipient_name : m.sender_name}
            </span>
            <span className="text-[10px] text-slate-400 flex items-center gap-1 shrink-0">
              <Clock size={10} aria-hidden />
              {formatDateTime(m.created_at)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <p className={`text-xs truncate flex-1 ${unread ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
              {m.content}
            </p>
            {m.recipient === null && (
              <Badge variant="outline" size="sm" className="shrink-0">
                {t('received.broadcast')}
              </Badge>
            )}
            {unread && (
              <Badge variant="error" size="sm" className="shrink-0">
                {t('new_badge')}
              </Badge>
            )}
            {variant === 'sent' && <ReadReceipt message={m} />}
            {variant === 'archived' && <Archive size={12} className="text-slate-400 shrink-0" aria-hidden />}
          </div>
        </div>
      </div>
    </button>
  );
}

function ReadReceipt({ message: m }: { message: InternalMessage }) {
  const { t } = useTranslation('messaging');
  if (!m.read_by) return null;

  if (m.recipient === null) {
    return m.read_by.length === 0 ? (
      <span className="inline-flex items-center gap-0.5 text-slate-400 shrink-0" title={t('read_by_none')}>
        <Check size={12} aria-hidden />
      </span>
    ) : (
      <span
        className="inline-flex items-center gap-0.5 text-blue-500 shrink-0"
        title={t('read_by_count', { count: m.read_by.length })}
      >
        <CheckCheck size={12} aria-hidden /> {m.read_by.length}
      </span>
    );
  }

  const isRead = m.read_by.includes(Number(m.recipient));
  return isRead ? (
    <span className="inline-flex items-center gap-0.5 text-emerald-600 shrink-0" title={t('read')}>
      <CheckCheck size={12} aria-hidden />
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-slate-400 shrink-0" title={t('unread')}>
      <Check size={12} aria-hidden />
    </span>
  );
}

interface MessageListProps {
  messages: InternalMessage[];
  variant: MessageListVariant;
  loading: boolean;
  isFetching?: boolean;
  selectedId: number | null;
  onSelect: (message: InternalMessage) => void;
  error?: Error | null;
  onRetry?: () => void;
}

export function MessageList({
  messages,
  variant,
  loading,
  isFetching = false,
  selectedId,
  onSelect,
  error,
  onRetry,
}: MessageListProps) {
  const { t } = useTranslation(['messaging', 'common']);

  if (error && messages.length === 0) {
    return (
      <EmptyState
        compact
        icon={<RefreshCw className="size-6" />}
        title={t('common:error')}
        description={t('load_error')}
        action={
          <Button type="button" size="sm" variant="outline" leftIcon={<RefreshCw size={14} aria-hidden />} onClick={onRetry}>
            {t('retry')}
          </Button>
        }
        className="py-10"
      />
    );
  }

  if (loading && messages.length === 0) {
    return (
      <div className="grid gap-2" aria-busy="true" aria-label={t('common:loading')}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full bg-slate-200" />
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    const emptyKey =
      variant === 'received'
        ? 'received.empty'
        : variant === 'sent'
          ? 'sent.empty'
          : variant === 'archived'
            ? 'no_archived'
            : 'no_messages';
    return <EmptyState compact icon={<MessageSquare className="size-6" />} title={t(emptyKey)} className="py-10" />;
  }

  return (
    <div className="grid gap-2">
      {isFetching && (
        <div className="text-xs text-slate-400 flex items-center gap-1.5 px-1" aria-live="polite">
          <RefreshCw size={12} className="animate-spin motion-reduce:animate-none" aria-hidden />
          {t('refreshing')}
        </div>
      )}
      {messages.map((m) => (
        <MessageRow key={m.id} message={m} variant={variant} selected={selectedId === m.id} onSelect={onSelect} />
      ))}
    </div>
  );
}
