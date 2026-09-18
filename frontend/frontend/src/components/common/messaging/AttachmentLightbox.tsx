import { useEffect, useState } from 'react';
import { FileText, Loader2, Paperclip } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogTitle } from '../../ui/Dialog';
import communicationService, { type InternalMessage } from '../../../services/communicationService';

interface AttachmentThumbProps {
  message: InternalMessage;
  onZoom: (url: string) => void;
}

export function AttachmentThumb({ message, onZoom }: AttachmentThumbProps) {
  const { t } = useTranslation('messaging');
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState('');
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!message.attachment_url) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    setLoading(true);
    setFailed(false);

    communicationService.getAttachment(message.id)
      .then((response) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(response.data);
        setBlobUrl(objectUrl);
        setContentType(response.data.type);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [message.attachment_url, message.id]);

  if (!message.attachment_url) return null;

  const isImage = contentType.startsWith('image/');
  const handleOpen = () => {
    if (!blobUrl) return;
    if (isImage) onZoom(blobUrl);
    else window.open(blobUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        handleOpen();
      }}
      disabled={!blobUrl || loading || failed}
      aria-label={t(isImage ? 'detail.view_attachment' : 'detail.open_document')}
      className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white overflow-hidden hover:bg-slate-50 max-w-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading && <Loader2 className="size-4 animate-spin motion-reduce:animate-none text-emerald-600" aria-hidden />}
      {!loading && failed && <Paperclip className="size-4 text-red-500" aria-hidden />}
      {!loading && !failed && isImage && blobUrl && (
        <img src={blobUrl} alt={t('detail.attachment_alt')} className="max-h-32 object-contain hidden md:block" />
      )}
      {!loading && !failed && !isImage && <FileText className="size-4 text-blue-600" aria-hidden />}
      <span className="p-2 pr-3 text-xs font-medium text-slate-700">
        {loading
          ? t('detail.loading_attachment')
          : failed
            ? t('detail.attachment_error')
            : t(isImage ? 'detail.view_attachment' : 'detail.open_document')}
      </span>
    </button>
  );
}

interface AttachmentLightboxProps {
  url: string | null;
  onClose: () => void;
}

export function AttachmentLightbox({ url, onClose }: AttachmentLightboxProps) {
  const { t } = useTranslation('messaging');

  return (
    <Dialog open={Boolean(url)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-5xl max-h-[90vh] h-[90vh] bg-black/90 border-none p-2 flex items-center justify-center"
        aria-label={t('zoom_image')}
      >
        <DialogTitle className="sr-only">{t('zoom_image')}</DialogTitle>
        {url && <img src={url} alt={t('detail.attachment_alt')} className="max-w-full max-h-full object-contain" />}
      </DialogContent>
    </Dialog>
  );
}
