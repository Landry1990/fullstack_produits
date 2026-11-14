import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { AlarmClock, X, ExternalLink, PackageX, TimerOff, HandCoins } from 'lucide-react';

interface MorningRecap {
    promis_dormants: { count: number; oldest_days: number };
    lots_perimes_rayon: { lots: number; unites: number; produits: number };
    ruptures_critiques: { count: number; top_produits: string[] };
}

const STORAGE_KEY = 'morning_recap_dismissed';

/**
 * Récapitulatif quotidien du pharmacien — une carte en bas à droite, affichée
 * une seule fois par jour (clé localStorage datée), réservée aux admins.
 * Signale : promis dormants, lots périmés encore en rayon, ruptures sur
 * produits à rotation. Le conteneur `fixed` est mutualisé dans Layout.
 */
export function MorningRecapPanel() {
    const { t } = useTranslation(['dashboard', 'common']);
    const { isAuthenticated, loading, user } = useAuth();
    const navigate = useNavigate();
    const isAdmin = !!user?.is_superuser || user?.role === 'PHARMACIEN';

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const [dismissed, setDismissed] = useState(
        () => localStorage.getItem(STORAGE_KEY) === todayKey
    );

    const { data } = useQuery<MorningRecap>({
        queryKey: ['dashboard', 'morning_recap'],
        queryFn: async () => {
            const res = await api.get<MorningRecap>('dashboard/morning_recap/');
            return res.data;
        },
        enabled: isAuthenticated && !loading && isAdmin,
        staleTime: 1000 * 60 * 30,
        refetchOnWindowFocus: false,
    });

    if (!data || dismissed) return null;

    const items = [
        data.promis_dormants.count > 0 && {
            key: 'promis',
            icon: HandCoins,
            color: 'text-violet-600 bg-violet-100 border-violet-500',
            title: t('dashboard:morning_recap.promis_dormants', {
                count: data.promis_dormants.count,
                days: data.promis_dormants.oldest_days,
            }),
            link: '/app/promis',
        },
        data.lots_perimes_rayon.lots > 0 && {
            key: 'perimes',
            icon: TimerOff,
            color: 'text-red-600 bg-red-100 border-red-500',
            title: t('dashboard:morning_recap.lots_perimes', {
                lots: data.lots_perimes_rayon.lots,
                unites: data.lots_perimes_rayon.unites,
                produits: data.lots_perimes_rayon.produits,
            }),
            link: '/app/perimes',
        },
        data.ruptures_critiques.count > 0 && {
            key: 'ruptures',
            icon: PackageX,
            color: 'text-amber-600 bg-amber-100 border-amber-500',
            title: t('dashboard:morning_recap.ruptures', { count: data.ruptures_critiques.count }),
            sub: data.ruptures_critiques.top_produits.slice(0, 3).join(', '),
            link: '/app/stock-analysis',
        },
    ].filter(Boolean) as { key: string; icon: typeof HandCoins; color: string; title: string; sub?: string; link: string }[];

    if (items.length === 0) return null;

    const dismiss = () => {
        localStorage.setItem(STORAGE_KEY, todayKey);
        setDismissed(true);
    };

    return (
        <div className="pointer-events-auto rounded-xl shadow-xl bg-white border border-slate-200 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 text-white">
                <AlarmClock className="size-4" />
                <span className="flex-1 text-sm font-bold">{t('dashboard:morning_recap.title')}</span>
                <button onClick={dismiss} className="shrink-0 text-slate-300 hover:text-white transition-colors" aria-label={t('common:close')}>
                    <X className="size-4" />
                </button>
            </div>
            <div className="divide-y divide-slate-100">
                {items.map(item => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.key}
                            onClick={() => { dismiss(); navigate(item.link); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50 transition-colors"
                        >
                            <span className={`shrink-0 p-1.5 rounded-lg ${item.color.split(' ').slice(0, 2).join(' ')}`}>
                                <Icon className={`size-4 ${item.color.split(' ')[0]}`} />
                            </span>
                            <span className="flex-1 min-w-0">
                                <span className="block text-xs font-semibold text-slate-700 leading-snug">{item.title}</span>
                                {item.sub && <span className="block text-[11px] text-slate-400 truncate mt-0.5">{item.sub}</span>}
                            </span>
                            <ExternalLink className="size-3.5 shrink-0 text-slate-300" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
