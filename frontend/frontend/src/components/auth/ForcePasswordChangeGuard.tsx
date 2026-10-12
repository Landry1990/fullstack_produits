import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { gooeyToast } from 'goey-toast';
import { AlertCircle, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import api, { setAuthToken } from '../../services/api';
import { safeStorage } from '../../utils/storage';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../shadcn/dialog';
import { Button } from '../shadcn/button';
import { Input } from '../shadcn/input';

/** Longueur minimale côté backend (AUTH_PASSWORD_VALIDATORS, min_length=4) */
const MIN_PASSWORD_LENGTH = 4;

/**
 * Extrait un message lisible depuis une réponse d'erreur DRF
 * ({detail: "..."} ou {detail: [...]} ou {champ: [...]}).
 */
const extractApiError = (err: unknown, fallback: string): string => {
  const data = (err as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === 'string' && data) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    for (const key of ['detail', 'new_password', 'old_password', 'non_field_errors']) {
      const value = obj[key];
      if (Array.isArray(value) && value.length) return value.join(' ');
      if (typeof value === 'string' && value) return value;
    }
    for (const value of Object.values(obj)) {
      if (Array.isArray(value) && value.length) return value.join(' ');
      if (typeof value === 'string' && value) return value;
    }
  }
  return fallback;
};

/**
 * Garde globale : quand le backend signale `must_change_password`, un dialogue
 * NON dismissible recouvre toute l'app authentifiée jusqu'au changement.
 * Côté serveur, ForcePasswordChangeMiddleware bloque déjà toute l'API — ce
 * composant n'est que l'UX associée.
 */
export default function ForcePasswordChangeGuard() {
  const { t } = useTranslation('auth');
  const { user, isAuthenticated } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isAuthenticated || !user?.must_change_password) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t('force_change.error_too_short', { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (newPassword === oldPassword) {
      setError(t('force_change.error_same'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('force_change.error_mismatch'));
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post<{ token: string; detail: string }>(
        'users/change-my-password/',
        { old_password: oldPassword, new_password: newPassword },
      );

      // Le backend a révoqué l'ancien token : on stocke le nouveau puis on
      // recharge pour repartir sur une session propre (flag retombé).
      setAuthToken(data.token);
      safeStorage.setItem('authToken', data.token);
      safeStorage.setItem('must_change_password', 'false');
      gooeyToast.success(t('force_change.success'), { duration: 4000 });
      window.location.reload();
    } catch (err) {
      const msg = extractApiError(err, t('force_change.error_generic'));
      setError(msg);
      gooeyToast.error(msg, { duration: 6000 });
      setSubmitting(false);
    }
  };

  return (
    <Dialog open>
      <DialogContent
        hideCloseButton
        size="sm"
        onInteractOutside={(e: Event) => e.preventDefault()}
        onEscapeKeyDown={(e: KeyboardEvent) => e.preventDefault()}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="shrink-0 h-10 w-10 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <DialogTitle>{t('force_change.title')}</DialogTitle>
              <DialogDescription className="mt-1">
                {t('force_change.subtitle')}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-sm bg-red-50 border border-red-200 text-red-600">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-800" htmlFor="fpc-old">
              {t('force_change.current')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                id="fpc-old"
                type="password"
                required
                autoFocus
                autoComplete="current-password"
                value={oldPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setOldPassword(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-800" htmlFor="fpc-new">
              {t('force_change.new')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                id="fpc-new"
                type="password"
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewPassword(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-800" htmlFor="fpc-confirm">
              {t('force_change.confirm')}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                id="fpc-confirm"
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <p className="text-xs text-slate-400">{t('force_change.rules_hint')}</p>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                {t('force_change.submitting')}
              </>
            ) : (
              t('force_change.submit')
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
