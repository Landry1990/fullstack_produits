import { RotateCcw } from 'lucide-react';
import type { TFunction } from 'i18next';

interface RestoreOverlayProps {
  restoring: boolean;
  restoreProgress: string[];
  t: TFunction;
}

export function RestoreOverlay({ restoring, restoreProgress, t }: RestoreOverlayProps) {
  if (!restoring) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-full max-w-md mx-4 p-6">
        <div className="flex items-center gap-3 mb-4">
          <RotateCcw className="w-6 h-6 text-red-500 animate-spin" />
          <h3 className="text-lg font-bold text-gray-900">{t('restore_in_progress')}</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">{t('restore_do_not_close')}</p>
        <div className="bg-gray-950 rounded-lg p-4 font-mono text-xs text-emerald-400 min-h-[120px] max-h-48 overflow-y-auto space-y-1">
          {restoreProgress.map((line) => (
            <div key={line} className="flex items-start gap-2">
              <span className="text-emerald-600 select-none">{'>'}</span>
              <span>{line}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 text-yellow-400 animate-pulse">
            <span>{'>'}</span>
            <span>{t('restore_progress.waiting')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
