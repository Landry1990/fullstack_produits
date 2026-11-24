import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Coins } from 'lucide-react';
import { Checkbox } from '../shadcn/checkbox';
import { Button } from '../shadcn/button';
import { safeStorage } from '../../utils/storage';
import { suggestCashChange } from '../../utils/cashChange';

const PREFERENCE_KEY = 'zenith.cash-change-assistance.enabled';

interface CashChangeAssistantProps {
    amountDue: number;
    amountReceived: number;
    onAmountReceivedChange: (amount: number) => void;
    disabled?: boolean;
}

export default function CashChangeAssistant({ amountDue, amountReceived, onAmountReceivedChange, disabled = false }: CashChangeAssistantProps) {
    const { t, i18n } = useTranslation('caisse');
    const id = useId();
    const [enabled, setEnabled] = useState(() => safeStorage.getItem(PREFERENCE_KEY, 'local') !== 'false');
    const [dismissed, setDismissed] = useState<string | null>(null);
    const [confirmed, setConfirmed] = useState<{ due: number; received: number; additional: number } | null>(null);
    const lastApplied = useRef<string | null>(null);
    const key = `${amountDue}:${amountReceived}`;
    useEffect(() => { lastApplied.current = null; }, [key]);
    const confirmationVisible = enabled && confirmed?.due === amountDue && confirmed.received === amountReceived;
    const suggestion = enabled && !confirmationVisible && dismissed !== key ? suggestCashChange(amountDue, amountReceived) : null;
    const money = (value: number) => `${value.toLocaleString(i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR')} F`;
    const confirmAdditional = () => {
        if (disabled || !suggestion || lastApplied.current === key) return;
        lastApplied.current = key;
        setConfirmed({ due: amountDue, received: suggestion.newAmountReceived, additional: suggestion.additional });
        onAmountReceivedChange(suggestion.newAmountReceived);
    };

    return (
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3" aria-label={t('change_assistant.title')}>
            <div className="flex items-start gap-3">
                <Checkbox id={id} checked={enabled} disabled={disabled} className="mt-1 size-5 cursor-pointer" aria-describedby={`${id}-hint`} onCheckedChange={value => {
                    const checked = value === true;
                    setEnabled(checked);
                    setDismissed(null);
                    safeStorage.setItem(PREFERENCE_KEY, String(checked), 'local');
                }} />
                <div className="min-w-0">
                    <label htmlFor={id} className="block cursor-pointer text-sm font-semibold text-slate-900">{t('change_assistant.title')}</label>
                    <p id={`${id}-hint`} className="mt-1 text-xs text-slate-600">{t('change_assistant.option_hint')}</p>
                </div>
            </div>
            <div aria-live="polite" aria-atomic="true">
                {suggestion ? (
                    <div className="space-y-3 rounded-lg border border-emerald-200 bg-white p-3">
                        <p className="flex items-center gap-2 text-sm font-semibold text-emerald-900"><Coins className="size-4 shrink-0" aria-hidden="true" />{t('change_assistant.suggestion_title')}</p>
                        <p className="text-sm text-slate-800">{t('change_assistant.suggestion', {
                            original: money(suggestion.originalChange), additional: money(suggestion.additional), change: money(suggestion.newChange),
                        })}</p>
                        <p className="text-xs text-slate-600">{t('change_assistant.pieces', { before: suggestion.originalPieces, after: suggestion.newPieces })}</p>
                        <p className="text-xs text-slate-700">{t('change_assistant.confirm_hint')}</p>
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" disabled={disabled} onClick={confirmAdditional} className="h-auto min-h-11 whitespace-normal text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2">
                                {t('change_assistant.received', { amount: money(suggestion.additional) })}
                            </Button>
                            <Button type="button" variant="outline" disabled={disabled} onClick={() => setDismissed(key)} className="min-h-11 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-700 focus-visible:ring-offset-2">{t('change_assistant.without_extra')}</Button>
                        </div>
                    </div>
                ) : confirmationVisible ? (
                    <p className="text-sm font-medium text-emerald-900">{t('change_assistant.confirmed', { amount: money(confirmed.additional), received: money(amountReceived), change: money(amountReceived - amountDue) })}</p>
                ) : enabled ? (
                    <p className="text-xs text-slate-600">{t('change_assistant.no_suggestion')}</p>
                ) : null}
            </div>
        </section>
    );
}
