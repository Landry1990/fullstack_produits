import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import api from '../../services/api';
import { Card, CardContent, CardHeader, CardTitle } from '../shadcn/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../shadcn/table';
import { formatCurrency } from '../../utils/formatters';

interface EbeReport {
    provisoire: boolean;
    lignes: { ref: string; libelle: string; comptes: string[]; montant: string | number }[];
}

export default function EbeTab({ dateRange }: { dateRange: { start: string; end: string } }) {
    const { t, i18n } = useTranslation('accounting');
    const { data, isPending, isError, isFetching } = useQuery<EbeReport>({
        queryKey: ['accounting', 'ebe', dateRange],
        queryFn: async () => (await api.get('compta/ecritures/ebe/', {
            params: { date_debut: dateRange.start, date_fin: dateRange.end },
        })).data,
        staleTime: 0,
    });
    const money = (value: string | number) => formatCurrency(Number(value), i18n.language.startsWith('en') ? 'en-GB' : 'fr-FR');

    return (
        <Card aria-busy={isFetching}>
            <CardHeader>
                <CardTitle>{t('ebe.title')}</CardTitle>
                <p className="text-sm text-slate-600">{t('ebe.formula')}</p>
            </CardHeader>
            <CardContent className="space-y-4">
                <p role="note" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                    {t('ebe.warning')}
                </p>
                {isPending ? <p role="status">{t('ebe.loading')}</p> : isError ? (
                    <p role="alert" className="text-red-700">{t('ebe.error')}</p>
                ) : data && (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('ebe.reference')}</TableHead>
                                <TableHead>{t('ebe.label')}</TableHead>
                                <TableHead>{t('ebe.accounts')}</TableHead>
                                <TableHead className="text-right">{t('ebe.amount')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {data.lignes.map(row => (
                                <TableRow key={row.ref} className={row.ref.startsWith('X') ? 'bg-blue-50 font-semibold' : ''}>
                                    <TableCell>{row.ref}</TableCell>
                                    <TableCell>{t(`ebe.rows.${row.ref}`)}</TableCell>
                                    <TableCell>{row.comptes.join(', ') || '—'}</TableCell>
                                    <TableCell className="text-right whitespace-nowrap tabular-nums">{money(row.montant)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}
