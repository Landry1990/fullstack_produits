import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '../shadcn/dialog';

interface PremiumModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Called when modal should close (overlay click, Escape, ✕ button) */
  onClose: () => void;
  /** Modal title displayed in the header */
  title: string;
  /** Optional subtitle below the title */
  subtitle?: string;
  /** Optional icon displayed in the header (JSX element) */
  icon?: React.ReactNode;
  /** Gradient start color class, e.g. "primary/10" */
  gradientFrom?: string;
  /** Gradient middle color class */
  gradientVia?: string;
  /** Gradient end color class */
  gradientTo?: string;
  /** Max width class, e.g. "max-w-lg", "max-w-xl", "max-w-5xl" */
  maxWidth?: string;
  /** Modal content */
  children: React.ReactNode;
  /** Optional footer (rendered below children, inside the modal) */
  footer?: React.ReactNode;
  /** If true, prevents closing via overlay click, Escape key, and ✕ button */
  disableClose?: boolean;
  /** Additional CSS classes for the modal container */
  className?: string;
}

/**
 * PremiumModal — Composant modal premium réutilisable.
 *
 * Design cohérent avec overlay sombre, header gradient, bouton fermeture,
 * et support clavier (Escape).
 *
 * Internals basés sur le composant Dialog (Radix) : focus trap, gestion
 * d'Escape, aria et blocage du scroll body sont gérés nativement.
 *
 * @example
 * <PremiumModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="Nouvelle Relation"
 *   subtitle="Configurez une nouvelle règle"
 *   icon={<MyIcon />}
 *   gradientFrom="primary/10"
 *   gradientTo="secondary/10"
 * >
 *   <form>...</form>
 * </PremiumModal>
 */
const PremiumModal: React.FC<PremiumModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  gradientFrom = 'primary/10',
  gradientVia = 'secondary/5',
  gradientTo = 'accent/10',
  maxWidth = 'max-w-lg',
  children,
  footer,
  disableClose = false,
  className = '',
}) => {
  const { t } = useTranslation('common');

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !disableClose) onClose();
      }}
    >
      <DialogContent
        hideCloseButton
        // aria-describedby optionnel : on fournit DialogDescription quand subtitle existe
        aria-describedby={undefined}
        onEscapeKeyDown={(e) => {
          if (disableClose) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (disableClose) e.preventDefault();
        }}
        className={`p-0 gap-0 rounded-2xl sm:rounded-2xl border-0 shadow-2xl w-full ${maxWidth} overflow-hidden flex flex-col max-h-[90vh] bg-white dark:bg-slate-900 ${className}`}
      >
        {/* Header */}
        <div className={`bg-gradient-to-r from-${gradientFrom} via-${gradientVia} to-${gradientTo} px-6 py-5 border-b border-slate-200 dark:border-slate-700 shrink-0`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <div className="size-10 rounded-xl bg-white/50 dark:bg-slate-800/50 flex items-center justify-center shrink-0">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <DialogTitle className="font-bold text-lg text-slate-800 dark:text-slate-100 truncate">
                  {title}
                </DialogTitle>
                {subtitle && (
                  <DialogDescription className="text-xs text-slate-400 dark:text-slate-500 truncate">
                    {subtitle}
                  </DialogDescription>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center size-8 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={disableClose}
              aria-label={t('close')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
          {children}
        </div>

        {/* Footer (optional) */}
        {footer && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 shrink-0">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PremiumModal;
