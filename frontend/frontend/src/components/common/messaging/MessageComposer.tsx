import { useRef, type ChangeEvent, type Dispatch, type FormEvent, type MouseEvent } from 'react';
import { Paperclip, Reply, Send, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import { Button } from '../../ui/Button';
import { Select } from '../../ui/Select';
import { Textarea } from '../../ui/Textarea';
import type { SimpleUser } from '../../../services/userService';
import { useSendMessageMutation } from './useMessaging';
import type { ComposerAction, ComposerState } from './types';

const ACCEPTED_ATTACHMENT_TYPES = '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp';
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

interface MessageComposerProps {
  users: SimpleUser[];
  isAdmin: boolean;
  state: ComposerState;
  dispatch: Dispatch<ComposerAction>;
  onCancel: () => void;
  onSent: () => void;
}

export function MessageComposer({ users, isAdmin, state, dispatch, onCancel, onSent }: MessageComposerProps) {
  const { t } = useTranslation(['messaging', 'common']);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { recipientId, msgContent, replyingTo, attachmentFile } = state;
  const sendMessageMutation = useSendMessageMutation();

  const canSubmit = (isAdmin || recipientId !== '') && (msgContent.trim() !== '' || attachmentFile !== null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (sendMessageMutation.isPending || !canSubmit) return;

    try {
      await sendMessageMutation.mutateAsync({
        recipient: recipientId === '' ? null : recipientId,
        content: msgContent,
        parent: replyingTo?.id || null,
        attachment: attachmentFile,
      });
      dispatch({ type: 'RESET' });
      onSent();
    } catch {
      return;
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_ATTACHMENT_SIZE) {
      gooeyToast.error(t('new.attachment_too_large'));
      e.target.value = '';
      return;
    }
    dispatch({ type: 'SET_ATTACHMENT', payload: file });
  };

  const clearAttachment = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch({ type: 'SET_ATTACHMENT', payload: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 overflow-y-auto">
      <h4 className="text-lg font-semibold text-slate-700 mb-6 border-b border-slate-200 pb-2">
        {t('new.title')}
      </h4>
      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6 flex flex-col flex-1 min-h-0">
        <div className="w-full shrink-0">
          <Select
            id="messaging-recipient"
            label={t('new.recipient')}
            value={recipientId}
            onChange={(e) =>
              dispatch({ type: 'SET_RECIPIENT', payload: e.target.value === '' ? '' : Number(e.target.value) })
            }
            required={!isAdmin}
          >
            <option value="" disabled={!isAdmin}>
              {isAdmin ? t('new.all') : t('new.select_recipient')}
            </option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex-1 min-h-[120px] flex flex-col">
          {replyingTo && (
            <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-indigo-200 flex flex-col gap-1 relative pr-10">
              <button
                type="button"
                aria-label={t('new.cancel_reply')}
                className="absolute right-2 top-2 min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-red-500 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                onClick={() => dispatch({ type: 'SET_REPLY_TO', payload: null })}
              >
                <X size={14} aria-hidden />
              </button>
              <span className="text-xs font-semibold text-blue-600 flex items-center gap-1">
                <Reply size={12} aria-hidden /> {t('new.replying_to', { name: replyingTo.sender_name })}
              </span>
              <p className="text-xs text-slate-500 line-clamp-2 italic border-l-2 border-indigo-300 pl-2">
                {replyingTo.content}
              </p>
            </div>
          )}
          <label
            htmlFor="messaging-content"
            className="block text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5"
          >
            {t('new.content')}
          </label>
          <Textarea
            id="messaging-content"
            className="flex-1 bg-white"
            value={msgContent}
            onChange={(e) => dispatch({ type: 'SET_CONTENT', payload: e.target.value })}
            required={!attachmentFile}
            placeholder={t('new.placeholder')}
          />
        </div>

        <div className="shrink-0">
          <label className="flex min-h-11 items-center gap-2 px-4 py-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 cursor-pointer hover:bg-slate-100 transition-colors motion-reduce:transition-none relative focus-within:ring-2 focus-within:ring-blue-500">
            <Paperclip size={18} className="text-blue-600" aria-hidden />
            <span className="text-sm font-medium text-slate-500 truncate mr-8">
              {attachmentFile ? attachmentFile.name : t('new.attachment_help')}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_ATTACHMENT_TYPES}
              className="sr-only"
              aria-label={t('new.attachment_help')}
              onChange={handleFileChange}
            />
            {attachmentFile && (
              <button
                type="button"
                aria-label={t('new.remove_attachment')}
                className="absolute right-2 min-h-11 min-w-11 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-full bg-white shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                onClick={clearAttachment}
              >
                <X size={14} aria-hidden />
              </button>
            )}
          </label>
        </div>

        <div className="flex gap-2 md:gap-3 py-4 shrink-0">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1" disabled={sendMessageMutation.isPending}>
            {t('common:cancel')}
          </Button>
          <Button
            type="submit"
            variant="primary"
            isLoading={sendMessageMutation.isPending}
            disabled={!canSubmit}
            leftIcon={<Send size={16} aria-hidden />}
            className="flex-1"
          >
            {sendMessageMutation.isPending ? t('new.sending') : t('new.send')}
          </Button>
        </div>
      </form>
    </div>
  );
}
