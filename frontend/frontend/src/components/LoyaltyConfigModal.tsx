import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Gift } from 'lucide-react';
import api from '../services/api';
import { gooeyToast } from 'goey-toast';
import { logger } from '../utils/logger';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from './shadcn/dialog';
import { Button } from './shadcn/button';
import { Input } from './shadcn/input';

interface LoyaltySetting {
    id: number;
    amount_per_point: string;
    point_value: string;
    auto_reward_threshold: number;
    auto_reward_percent: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function LoyaltyConfigModal({ isOpen, onClose }: Props) {
    const { t, i18n } = useTranslation(['clients', 'common']);
    const locale = i18n.language === 'fr' ? 'fr-FR' : 'en-US';

    const [settings, setSettings] = useState<LoyaltySetting | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchSettings();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen]);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await api.get('loyalty-settings/');

            let data = res.data;
            if (data && typeof data === 'object' && 'results' in data && Array.isArray(data.results)) {
                data = data.results[0];
            } else if (Array.isArray(data)) {
                data = data[0];
            }

            if (data && typeof data === 'object' && 'amount_per_point' in data) {
                setSettings(data);
            } else {
                setSettings({
                    id: 0,
                    amount_per_point: '1000',
                    point_value: '10',
                    auto_reward_threshold: 0,
                    auto_reward_percent: '0',
                });
            }
        } catch (err) {
            logger.error('LoyaltyConfigModal: Fetch error', err);
            setSettings({
                id: 0,
                amount_per_point: '1000',
                point_value: '10',
                auto_reward_threshold: 0,
                auto_reward_percent: '0',
            });
            gooeyToast.error(t('common:messages.error_loading'));
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;
        setSaving(true);
        try {
            if (settings.id) {
                await api.put(`loyalty-settings/${settings.id}/`, settings);
            } else {
                await api.post('loyalty-settings/', settings);
            }
            onClose();
            gooeyToast.success(t('common:messages.saved'));
        } catch (err) {
            gooeyToast.error(t('common:messages.error_saving'));
            logger.error(err);
        } finally {
            setSaving(false);
        }
    };

    const thresholdAmount = settings && Number(settings.amount_per_point) > 0 && settings.auto_reward_threshold > 0
        ? (Number(settings.auto_reward_threshold) * Number(settings.amount_per_point)).toLocaleString(locale)
        : null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                            <Gift className="size-5" />
                        </div>
                        <div>
                            <DialogTitle>{t('clients:loyalty.title')}</DialogTitle>
                            <DialogDescription>{t('clients:loyalty.subtitle')}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {loading || !settings ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="size-6 animate-spin text-emerald-600" />
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="space-y-5">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label htmlFor="amount_per_point" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    {t('clients:loyalty.amount_per_point')}
                                </label>
                                <Input
                                    id="amount_per_point"
                                    type="number"
                                    disableUppercase
                                    value={settings.amount_per_point}
                                    onChange={e => setSettings({ ...settings, amount_per_point: e.target.value })}
                                    className="h-12"
                                />
                                <p className="text-xs text-slate-400">{t('clients:loyalty.amount_per_point_hint')}</p>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="point_value" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                    {t('clients:loyalty.point_value')}
                                </label>
                                <Input
                                    id="point_value"
                                    type="number"
                                    disableUppercase
                                    value={settings.point_value}
                                    onChange={e => setSettings({ ...settings, point_value: e.target.value })}
                                    className="h-12"
                                />
                                <p className="text-xs text-slate-400">{t('clients:loyalty.point_value_hint')}</p>
                            </div>

                            <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">{t('clients:loyalty.auto_reward')}</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label htmlFor="auto_reward_threshold" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                            {t('clients:loyalty.threshold')}
                                        </label>
                                        <Input
                                            id="auto_reward_threshold"
                                            type="number"
                                            disableUppercase
                                            value={settings.auto_reward_threshold}
                                            onChange={e => setSettings({ ...settings, auto_reward_threshold: parseInt(e.target.value) || 0 })}
                                            className="h-12"
                                        />
                                        <p className="text-xs text-slate-400">{t('clients:loyalty.threshold_hint')}</p>
                                        {thresholdAmount && (
                                            <p className="text-xs text-emerald-600 font-semibold">
                                                {t('clients:loyalty.threshold_amount', { amount: thresholdAmount })}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label htmlFor="auto_reward_percent" className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                            {t('clients:loyalty.discount')}
                                        </label>
                                        <Input
                                            id="auto_reward_percent"
                                            type="number"
                                            step="0.01"
                                            disableUppercase
                                            value={settings.auto_reward_percent}
                                            onChange={e => setSettings({ ...settings, auto_reward_percent: e.target.value })}
                                            className="h-12"
                                        />
                                        <p className="text-xs text-slate-400">{t('clients:loyalty.discount_hint')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="pt-2">
                            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                                {t('common:cancel')}
                            </Button>
                            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={saving}>
                                {saving && <Loader2 className="size-4 animate-spin mr-2" />}
                                {t('common:save')}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
