import { useEffect, type ReactNode } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '../shadcn/button';

interface WarningModalShellProps {
  title: string;
  subtitle: string;
  onClose: () => void;
  closeLabel: string;
  actionLabel: string;
  children: ReactNode;
}

export function WarningModalShell({ title, subtitle, onClose, closeLabel, actionLabel, children }: WarningModalShellProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className="bg-base-100 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in duration-200"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        {/* Header */}
        <div className="bg-warning/10 p-6 border-b border-warning/20">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-warning/20 rounded-xl">
              <AlertTriangle className="size-8 text-warning" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-warning">
                {title}
              </h3>
              <p className="text-base-content/70 mt-1">
                {subtitle}
              </p>
            </div>
            <Button
              onClick={onClose}
              variant="ghost" size="icon" className="rounded-full"
              aria-label={closeLabel}
            >
              <X className="size-5" />
            </Button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {children}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-base-300 bg-base-200/50">
          <button
            onClick={onClose}
            className="inline-flex items-center justify-center w-full gap-2 px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-warning transition-colors"
          >
            <X className="size-4" />
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StatCard({ icon, title, value, subtitle }: { icon: ReactNode; title: string; value: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="bg-error/10 border border-red-200 rounded-xl p-4">
      <div className="flex items-center gap-2 text-error mb-2">
        {icon}
        <span className="font-bold text-sm">{title}</span>
      </div>
      <p className="text-3xl font-black text-error">{value}</p>
      {subtitle && <p className="text-xs text-base-content/50">{subtitle}</p>}
    </div>
  );
}

export function InfoBox({ boxClassName, textClassName, label, children }: { boxClassName: string; textClassName: string; label: string; children: ReactNode }) {
  return (
    <div className={`border rounded-xl p-4 ${boxClassName}`}>
      <p className={`text-sm font-medium ${textClassName}`}>
        <span className="font-bold">{label}</span> {children}
      </p>
    </div>
  );
}
