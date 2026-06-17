import { useState, useRef, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import PremiumModal from './common/PremiumModal';

interface PasswordConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

export default function PasswordConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message
}: PasswordConfirmModalProps) {
  const { t } = useTranslation(['users', 'common']);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      const timeoutId = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timeoutId);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;

    setLoading(true);
    setError(null);

    try {
      await api.post('verify-password/', { password });
      onConfirm();
      onClose();
    } catch (err) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 403) {
             setError(t('password_confirm.incorrect'));
             toast.error(t('password_confirm.incorrect'));
        } else {
             setError(t('password_confirm.tech_error'));
             toast.error(t('password_confirm.tech_error'));
        }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={message}
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      }
      gradientFrom="red-50"
      gradientVia="amber-50/50"
      gradientTo="red-50"
      disableClose={loading}
    >
      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            {t('password_confirm.label')}
          </label>
          <input
            ref={inputRef}
            type="password"
            placeholder={t('password_confirm.placeholder')}
            className={`w-full h-12 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none transition-all ${error ? 'border-red-500 focus:border-red-500' : ''}`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="current-password"
          />
          {error && (
            <p className="text-xs text-red-600 mt-1.5">{error}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="inline-flex items-center justify-center h-9 px-6 rounded-xl text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors" onClick={onClose} disabled={loading}>
            {t('common:cancel')}
          </button>
          <button type="submit" className="inline-flex items-center justify-center h-9 px-8 rounded-xl text-sm font-semibold bg-red-600 text-white shadow-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed" disabled={loading || !password}>
            {loading ? <div className="animate-spin rounded-full size-4 border-b-2 border-white"></div> : t('common:confirm')}
          </button>
        </div>
      </form>
    </PremiumModal>
  );
}

