import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { QrCode, Printer, Loader2, Barcode } from 'lucide-react';
import { gooeyToast } from 'goey-toast';
import PremiumModal from '../common/PremiumModal';
import { Button } from '../shadcn/button';
import * as esc from '../../utils/escpos/encoder';
import { printEscpos } from '../../services/qzPrinter';
import { logger } from '../../utils/logger';
import type { ManagedUser } from './usersMeta';

type BadgeFormat = 'qr' | 'code128';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  user: ManagedUser | null;
}

/**
 * Imprime sur l'imprimante ticket un badge d'accès : id + nom de
 * l'utilisateur + code (QR ou CODE128) contenant son mot de passe.
 * Le mot de passe n'est pas récupérable (hashé) : l'admin le ressaisit.
 */
export default function UserBadgeDialog({ isOpen, onClose, user }: Props) {
  const { t } = useTranslation(['users', 'common']);
  const [password, setPassword] = useState('');
  const [format, setFormat] = useState<BadgeFormat>('qr');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setFormat('qr');
    }
  }, [isOpen]);

  const handlePrint = async () => {
    if (!user || !password) {
      gooeyToast.error(t('badge.password_required'));
      return;
    }
    setPrinting(true);
    try {
      const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim();
      const commands =
        esc.init() +
        esc.center() +
        esc.boldOn() +
        esc.line(t('badge.title')) +
        esc.boldOff() +
        esc.line(`ID: ${user.id}`) +
        esc.line(user.username) +
        (fullName ? esc.line(fullName) : '') +
        esc.lf() +
        (format === 'qr' ? esc.qrCode(password, 10) : esc.barcodeCODE128(password)) +
        esc.lf() +
        esc.feed(3) +
        esc.cut(true);
      if (await printEscpos(commands)) {
        gooeyToast.success(t('badge.sent'));
        onClose();
      } else {
        gooeyToast.error(t('badge.print_error'));
      }
    } catch (err) {
      logger.warn('Impression badge utilisateur impossible', err);
      const detail = err instanceof Error ? ` (${err.message})` : '';
      gooeyToast.error(t('badge.print_error') + detail);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <PremiumModal
      isOpen={isOpen}
      onClose={onClose}
      title={t('badge.title')}
      subtitle={t('badge.subtitle', { username: user?.username })}
      icon={<QrCode className="h-5 w-5" />}
      maxWidth="max-w-md"
      footer={
        <div className="flex justify-end">
          <Button type="submit" form="badge-print-form" disabled={printing || !password} className="gap-2">
            {printing ? <Loader2 className="size-4 animate-spin" /> : <Printer className="size-4" />}
            {t('badge.print')}
          </Button>
        </div>
      }
    >
      <form id="badge-print-form" onSubmit={(e) => { e.preventDefault(); handlePrint(); }} className="space-y-5 px-6 py-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="badge-password" className="text-sm font-bold text-slate-500">
            {t('badge.password_label')}
          </label>
          <input
            id="badge-password"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-10 px-3 border rounded-xl text-sm"
          />
          <p className="text-xs text-slate-400">{t('badge.password_hint')}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-bold text-slate-500">{t('badge.format_label')}</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setFormat('qr')}
              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${format === 'qr' ? 'border-indigo-300 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              <QrCode className="size-4" />
              {t('badge.format_qr')}
            </button>
            <button
              type="button"
              onClick={() => setFormat('code128')}
              className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${format === 'code128' ? 'border-indigo-300 bg-indigo-50 text-indigo-600' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
            >
              <Barcode className="size-4" />
              {t('badge.format_barcode')}
            </button>
          </div>
        </div>

        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {t('badge.security_warning')}
        </p>
      </form>
    </PremiumModal>
  );
}
