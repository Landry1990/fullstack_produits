import React, { useEffect, useCallback } from 'react';

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
  // Escape key handler
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && !disableClose) {
      onClose();
    }
  }, [onClose, disableClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={() => !disableClose && onClose()}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} overflow-hidden flex flex-col max-h-[90vh] ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`bg-gradient-to-r from-${gradientFrom} via-${gradientVia} to-${gradientTo} px-6 py-5 border-b border-gray-100 shrink-0`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <div className="w-10 h-10 rounded-xl bg-white/50 flex items-center justify-center shrink-0">
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-bold text-lg text-gray-800 truncate">{title}</h3>
                {subtitle && <p className="text-xs text-gray-400 truncate">{subtitle}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-ghost btn-circle btn-sm shrink-0"
              disabled={disableClose}
              aria-label="Fermer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body (scrollable) */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>

        {/* Footer (optional) */}
        {footer && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export default PremiumModal;
