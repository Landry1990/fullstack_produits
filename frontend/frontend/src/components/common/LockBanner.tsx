/**
 * Bannière de verrouillage pessimiste de document.
 * S'affiche en haut du formulaire d'édition pour indiquer :
 *   - Verrou acquis (mode édition actif)
 *   - Verrou refusé (document édité par quelqu'un d'autre → lecture seule)
 *   - Verrou libéré (disponible pour édition)
 */
import React from 'react';
import { Lock, Unlock, AlertTriangle, Loader2 } from 'lucide-react';
import type { DocumentLockState } from '../../hooks/useDocumentLock';

interface LockBannerProps {
  lock: DocumentLockState;
  documentLabel?: string;
}

export function LockBanner({ lock, documentLabel = 'document' }: LockBannerProps) {
  const { status, isLocked, isMine, holder, acquire, release } = lock;

  if (status === 'idle' || status === 'connecting') {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>Connexion au verrou…</span>
      </div>
    );
  }

  if (isMine) {
    return (
      <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-300 text-sm">
        <div className="flex items-center gap-2">
          <Unlock className="w-4 h-4" />
          <span>Vous éditez ce {documentLabel}. Les autres postes ne peuvent pas le modifier.</span>
        </div>
        <button
          onClick={release}
          className="ml-4 px-3 py-1 rounded text-xs bg-green-200 dark:bg-green-800 hover:bg-green-300 dark:hover:bg-green-700 transition-colors font-medium"
        >
          Libérer le verrou
        </button>
      </div>
    );
  }

  if (isLocked && !isMine) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-300 text-sm">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span>
          Ce {documentLabel} est en cours d'édition par <strong>{holder}</strong>. Vous êtes en lecture seule.
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between px-4 py-2 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-300 text-sm">
      <div className="flex items-center gap-2">
        <Lock className="w-4 h-4" />
        <span>Ce {documentLabel} est disponible pour édition.</span>
      </div>
      <button
        onClick={acquire}
        className="ml-4 px-3 py-1 rounded text-xs bg-blue-200 dark:bg-blue-800 hover:bg-blue-300 dark:hover:bg-blue-700 transition-colors font-medium"
      >
        Prendre le verrou
      </button>
    </div>
  );
}

export default LockBanner;
