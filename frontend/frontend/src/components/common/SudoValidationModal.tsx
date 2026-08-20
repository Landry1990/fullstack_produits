import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import PremiumModal from './PremiumModal';
import { Button } from '../shadcn/button';

interface SudoValidationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onValidate: (validatorId: number, password: string) => void | Promise<void>;
    saving: boolean;
    title?: string;
    message?: string;
    className?: string;
    forceCurrentUser?: boolean;
    permission?: string;
}

interface VerifiedUser {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
}

export default function SudoValidationModal({
    isOpen,
    onClose,
    onValidate,
    saving,
    title,
    message,
    className,
    permission
}: SudoValidationModalProps) {
    const { t } = useTranslation(['common']);
    const [password, setPassword] = useState('');
    const [passwordError, setPasswordError] = useState<string | null>(null);
    const passwordInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setPassword('');
            setPasswordError(null);
            const timer = setTimeout(() => {
                passwordInputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const handleConfirm = async () => {
        if (!password) return;
        setPasswordError(null);
        let verifiedUser: VerifiedUser | null = null;
        try {
            const checkRes = await api.post('users/verify_password/', permission ? { password, permission } : { password });
            if (!checkRes.data?.valid || !checkRes.data?.user?.id) {
                setPassword('');
                setPasswordError(t('common:sudo.invalid_password'));
                setTimeout(() => passwordInputRef.current?.focus(), 50);
                return;
            }
            verifiedUser = checkRes.data.user;
        } catch (error: unknown) {
            setPassword('');
            const errObj = error as { response?: { data?: { detail?: string } } };
            const msg = errObj?.response?.data?.detail || t('common:sudo.invalid_password');
            setPasswordError(msg);
            setTimeout(() => passwordInputRef.current?.focus(), 50);
            return;
        }
        if (!verifiedUser) return;
        try {
            await onValidate(verifiedUser.id, password);
        } catch (error: unknown) {
            setPassword('');
            const errObj = error as { response?: { data?: { detail?: string; error?: string } }; message?: string };
            const msg = errObj?.response?.data?.detail || errObj?.response?.data?.error || errObj?.message || t('common:sudo.invalid_password');
            setPasswordError(msg);
            setTimeout(() => passwordInputRef.current?.focus(), 50);
        }
    };

    return (
        <PremiumModal
            isOpen={isOpen}
            onClose={onClose}
            title={title || t('common:sudo.validate_title')}
            subtitle={t('common:sudo.validate_subtitle')}
            icon={
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
            }
            gradientFrom="success/10"
            gradientVia="warning/5"
            gradientTo="success/10"
            disableClose={saving}
            className={className}
        >
            <div className="p-6 space-y-5">
                {message && (
                    <p className="text-sm text-base-content/80 whitespace-pre-wrap">{message}</p>
                )}

                <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-base-content/40 mb-2">
                        {t('common:sudo.validate_password')}
                        <span className="text-error ml-2 normal-case">{t('common:sudo.validate_required')}</span>
                    </label>
                    <p className="text-[11px] text-base-content/40 mb-2">{t('common:sudo.validate_hint', { defaultValue: 'Saisissez le mot de passe du titulaire/pharmacien' })}</p>
                    <input
                        ref={passwordInputRef}
                        type="password"
                        className={`w-full h-12 rounded-xl border bg-base-100 text-sm px-4 outline-none focus:ring-2 transition-all ${passwordError ? 'border-red-300 focus:border-error focus:ring-error/20' : 'border-base-300 focus:border-success focus:ring-success/20'}`}
                        placeholder={t('common:sudo.validate_password')}
                        value={password}
                        onChange={e => { setPassword(e.target.value); setPasswordError(null); }}
                        onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                    />
                    {passwordError && (
                        <p className="text-error text-xs mt-1.5 flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            {passwordError}
                        </p>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="ghost" className="px-6 rounded-xl" onClick={onClose} disabled={saving}>
                        {t('common:sudo.cancel')}
                    </Button>
                    <Button
                        variant="default" className="px-8 rounded-xl shadow-lg shadow-emerald-600/20 bg-emerald-500 hover:bg-emerald-600"
                        onClick={handleConfirm}
                        disabled={saving || !password}
                    >
                        {saving ? <Loader2 className="size-4 animate-spin" /> : t('common:sudo.confirm')}
                    </Button>
                </div>
            </div>
        </PremiumModal>
    );
}

