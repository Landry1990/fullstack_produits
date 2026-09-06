/**
 * Bannière de verrouillage pessimiste de document.
 * S'affiche en haut du formulaire d'édition pour indiquer :
 *   - Verrou acquis (mode édition actif)
 *   - Verrou refusé (document édité par quelqu'un d'autre → lecture seule)
 *   - Verrou libéré (disponible pour édition)
 */
import React from 'react';
import { useTranslation, Trans } from 'react-i18next';
import { Lock, Unlock, AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '../shadcn/button';
import type { DocumentLockState } from '../../hooks/useDocumentLock';

interface LockBannerProps {
  lock: DocumentLockState;
  /** Phrase déjà traduite incluant l'article/genre du document, ex: "cette commande #123" */
  documentLabel?: string;
}

export function LockBanner({ lock, documentLabel }: LockBannerProps) {
  const { t } = useTranslation('common');
  const { status, isLocked, isMine, holder, acquire, release } = lock;
  const label = documentLabel || t('lock.document');

  if (status === 'idle' || status === 'connecting') {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-slate-100 text-slate-600 text-sm"
      >
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        <span>{t('lock.connecting')}</span>
      </div>
    );
  }

  if (isMine) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm"
      >
        <div className="flex items-center gap-3">
          <Unlock className="size-4 text-green-600" aria-hidden="true" />
          <span>{t('lock.owned', { document: label })}</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={release}
          className="text-green-700 hover:bg-green-100 hover:text-green-800"
        >
          {t('lock.release')}
        </Button>
      </div>
    );
  }

  if (isLocked && !isMine) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm"
      >
        <div className="flex items-center gap-3">
          <AlertTriangle className="size-4 text-amber-600 flex-shrink-0" aria-hidden="true" />
          <Trans
            i18nKey="lock.held_by"
            ns="common"
            values={{ document: label, holder: holder || t('lock.unknown_holder') }}
            components={[<strong className="font-semibold" key="holder" />]}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={acquire}
          className="text-amber-700 hover:bg-amber-100 hover:text-amber-800"
        >
          {t('lock.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 text-sm"
    >
      <div className="flex items-center gap-3">
        <Lock className="size-4 text-blue-600" aria-hidden="true" />
        <span>{t('lock.available', { document: label })}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={acquire}
        className="text-blue-700 hover:bg-blue-100 hover:text-blue-800"
      >
        {t('lock.acquire')}
      </Button>
    </div>
  );
}

export default LockBanner;
