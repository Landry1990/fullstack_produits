import { Archive, ArrowLeft, Clock, MessageSquare, Reply } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { formatDateTime } from '../../../utils/dateUtils';
import type { InternalMessage } from '../../../services/communicationService';
import { AttachmentThumb } from './AttachmentLightbox';

interface MessageDetailProps {
  message: InternalMessage | null;
  variant: 'received' | 'sent' | 'archived' | 'supervision';
  onBack?: () => void;
  onReply?: (message: InternalMessage) => void;
  onArchive?: (message: InternalMessage) => void;
  onZoomAttachment: (url: string) => void;
  actionBusy?: boolean;
}

export function MessageDetail({
  message: m,
  variant,
  onBack,
  onReply,
  onArchive,
  onZoomAttachment,
  actionBusy = false,
}: MessageDetailProps) {
  const { t } = useTranslation('messaging');

  if (!m) {
    return (
      <div className="hidden md:flex flex-1 items-center justify-center p-6">
        <EmptyState
          compact
          icon={<MessageSquare className="size-6" />}
          title={t('detail.select_message')}
          className="py-10"
        />
      </div>
    );
  }

  const showActions = variant === 'received';

  return (
    <article className="flex-1 min-w-0 flex flex-col p-4 md:p-6 overflow-y-auto" aria-label={t('detail.title')}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="md:hidden mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg self-start px-2"
        >
          <ArrowLeft size={16} aria-hidden /> {t('detail.back')}
        </button>
      )}

      {m.parent_content && (
        <div className="mb-4 p-3 bg-slate-100 rounded-lg border-l-2 border-indigo-400 text-xs">
          <span className="font-medium text-slate-500">
            {t('reply_to', { name: m.parent_sender_name })}
          </span>
          <p className="text-slate-400 truncate">{m.parent_content}</p>
        </div>
      )}

      <header className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3 min-w-0">
          <div
            aria-hidden
            className={`size-10 rounded-full flex items-center justify-center font-bold text-sm uppercase shrink-0 ${
              variant === 'supervision' ? 'bg-amber-100 text-amber-600' : 'bg-blue-600 text-white'
            }`}
          >
            {m.sender_name.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 truncate">
              <span className="text-slate-400 font-normal text-xs">{t('detail.from')} </span>
              {m.sender_name}
            </p>
            <p className="text-xs text-slate-500 truncate">
              <span className="text-slate-400">{t('detail.to')} </span>
              {m.recipient === null ? t('received.broadcast_label') : m.recipient_name}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {m.recipient === null && (
                <Badge variant="primary" size="sm">
                  {t('received.broadcast')}
                </Badge>
              )}
              {variant === 'received' && !m.is_read && (
                <Badge variant="error" size="sm">
                  {t('new_badge')}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
          <Clock size={12} aria-hidden />
          {formatDateTime(m.created_at)}
        </span>
      </header>

      <p className="text-sm text-slate-700 whitespace-pre-wrap py-4 flex-1">{m.content}</p>

      <AttachmentThumb message={m} onZoom={onZoomAttachment} />

      {showActions && (
        <div className="flex gap-2 pt-4 border-t border-slate-200 mt-4">
          {onReply && (
            <Button
              type="button"
              size="sm"
              variant="primary"
              leftIcon={<Reply size={14} aria-hidden />}
              onClick={() => onReply(m)}
              disabled={actionBusy}
              className="flex-1"
            >
              {t('actions.reply')}
            </Button>
          )}
          {onArchive && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              leftIcon={<Archive size={14} aria-hidden />}
              onClick={() => onArchive(m)}
              disabled={actionBusy}
              className="flex-1"
            >
              {t('actions.archive')}
            </Button>
          )}
        </div>
      )}
    </article>
  );
}
