import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import {
    Check, X, Printer, MessageCircle, Eye, Calendar, User, Phone,
    Package, Hash, FileText, Clock, CheckCircle2, XCircle
} from 'lucide-react';
import type { Promis } from '../../../types';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '../../shadcn/dialog';
import { Button } from '../../shadcn/button';
import { Badge } from '../../shadcn/badge';
import { cn } from '../../../lib/utils';

interface PromisDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    promis: Promis | null;
    onDeliver?: (id: number) => void;
    onCancel?: (id: number) => void;
    onPrint?: (id: number) => void;
    onSms?: (promis: Promis) => void;
    onWhatsApp?: (id: number) => void;
}

const statusBadgeVariant = (status: Promis['status']) => {
    switch (status) {
        case 'ATT': return { variant: 'secondary' as const, className: 'bg-amber-100 text-amber-700 border-amber-200' };
        case 'DEL': return { variant: 'default' as const, className: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
        case 'ANN': return { variant: 'destructive' as const, className: 'bg-red-100 text-red-700 border-red-200' };
        default: return { variant: 'outline' as const, className: '' };
    }
};

const statusIcon = (status: Promis['status']) => {
    switch (status) {
        case 'ATT': return <Clock className="size-3.5" />;
        case 'DEL': return <CheckCircle2 className="size-3.5" />;
        case 'ANN': return <XCircle className="size-3.5" />;
        default: return null;
    }
};

const InfoRow: React.FC<{
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
    mono?: boolean;
}> = ({ icon, label, children, mono }) => (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 last:border-0">
        <div className="mt-0.5 text-slate-400 shrink-0">{icon}</div>
        <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
            <div className={cn('text-sm text-slate-800 font-medium mt-0.5 break-words', mono && 'font-mono')}>
                {children}
            </div>
        </div>
    </div>
);

export const PromisDetailModal: React.FC<PromisDetailModalProps> = ({
    isOpen, onClose, promis,
    onDeliver, onCancel, onPrint, onSms, onWhatsApp
}) => {
    const { t, i18n } = useTranslation(['stock', 'common']);
    const currentLocale = i18n.language === 'fr' ? fr : enUS;

    if (!promis) return null;

    const badge = statusBadgeVariant(promis.status);
    const fmt = (d?: string | null, withTime = false) =>
        d ? format(new Date(d), withTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy', { locale: currentLocale }) : '-';

    return (
        <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
                {/* Header bandeau coloré selon statut */}
                <div className={cn(
                    'px-6 py-5 border-b',
                    promis.status === 'ATT' && 'bg-amber-50/60 border-amber-100',
                    promis.status === 'DEL' && 'bg-emerald-50/60 border-emerald-100',
                    promis.status === 'ANN' && 'bg-red-50/60 border-red-100'
                )}>
                    <DialogHeader className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <DialogTitle className="text-lg flex items-center gap-2">
                                <Eye className="size-5 text-slate-500" />
                                {t('stock:promis.detail.title', 'Détails du Promis')}
                            </DialogTitle>
                            <Badge variant={badge.variant} className={cn('gap-1 uppercase tracking-wider', badge.className)}>
                                {statusIcon(promis.status)}
                                {promis.status_display || promis.status}
                            </Badge>
                        </div>
                        <DialogDescription className="text-xs">
                            {t('stock:promis.detail.id_label', 'Promis')} #{promis.id}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                {/* Corps : infos */}
                <div className="px-6 py-4 max-h-[55vh] overflow-y-auto">
                    <InfoRow icon={<User className="size-4" />} label={t('stock:promis.table.client')}>
                        {promis.client_display || promis.client_name || '-'}
                    </InfoRow>
                    <InfoRow icon={<Phone className="size-4" />} label={t('stock:promis.table.phone')} mono>
                        {promis.client_phone_display || promis.client_phone || t('common:no_number', 'Sans numéro')}
                    </InfoRow>
                    <InfoRow icon={<Package className="size-4" />} label={t('stock:promis.table.product')}>
                        <div>{promis.produit_name || '-'}</div>
                        {promis.produit_cip && (
                            <div className="text-xs text-slate-400 font-mono mt-0.5">{promis.produit_cip}</div>
                        )}
                    </InfoRow>
                    <InfoRow icon={<Hash className="size-4" />} label={t('stock:promis.table.qty')}>
                        <span className="inline-flex items-center justify-center min-w-7 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-bold text-xs border border-slate-200">
                            {promis.quantite}
                        </span>
                    </InfoRow>
                    <InfoRow icon={<Calendar className="size-4" />} label={t('stock:promis.detail.date_promis', 'Date du promis')}>
                        {fmt(promis.date_promis, true)}
                    </InfoRow>
                    {promis.status === 'DEL' && (
                        <InfoRow icon={<CheckCircle2 className="size-4" />} label={t('stock:promis.detail.date_livraison', 'Date de livraison')}>
                            {fmt(promis.date_livraison)}
                        </InfoRow>
                    )}
                    {promis.notes && (
                        <InfoRow icon={<FileText className="size-4" />} label={t('stock:promis.modal.notes_label')}>
                            <span className="whitespace-pre-wrap">{promis.notes}</span>
                        </InfoRow>
                    )}
                </div>

                {/* Footer : actions contextuelles */}
                <DialogFooter className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => onPrint?.(promis.id)} className="gap-1.5">
                        <Printer className="size-4" />
                        {t('stock:promis.actions.print')}
                    </Button>
                    {promis.client_phone_display && (
                        <>
                            <Button variant="outline" size="sm" onClick={() => onSms?.(promis)} className="gap-1.5 text-blue-600 hover:text-blue-700">
                                <MessageCircle className="size-4" />
                                {t('stock:promis.actions.sms')}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => onWhatsApp?.(promis.id)} className="gap-1.5 text-emerald-600 hover:text-emerald-700">
                                <svg className="size-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .018 5.396.015 12.03c0 2.12.541 4.191 1.57 6.017L0 24l6.135-1.61a11.75 11.75 0 005.917 1.595h.004c6.637 0 12.032-5.396 12.035-12.032.002-3.218-1.248-6.242-3.517-8.511z"/></svg>
                                {t('stock:promis.actions.whatsapp')}
                            </Button>
                        </>
                    )}
                    {promis.status === 'ATT' && (
                        <>
                            <Button variant="outline" size="sm" onClick={() => onCancel?.(promis.id)} className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50">
                                <X className="size-4" />
                                {t('stock:promis.actions.cancel')}
                            </Button>
                            <Button variant="default" size="sm" onClick={() => onDeliver?.(promis.id)} className="gap-1.5">
                                <Check className="size-4" />
                                {t('stock:promis.actions.deliver')}
                            </Button>
                        </>
                    )}
                    {promis.status !== 'ATT' && (
                        <>
                            <Button variant="outline" size="sm" disabled className="gap-1.5 text-slate-400 opacity-60" title={promis.status === 'DEL' ? t('stock:promis.actions.already_delivered') : t('stock:promis.actions.already_cancelled')}>
                                <X className="size-4" />
                                {t('stock:promis.actions.cancel')}
                            </Button>
                            <Button variant="default" size="sm" disabled className="gap-1.5 opacity-60" title={promis.status === 'DEL' ? t('stock:promis.actions.already_delivered') : t('stock:promis.actions.already_cancelled')}>
                                <Check className="size-4" />
                                {t('stock:promis.actions.deliver')}
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default PromisDetailModal;
