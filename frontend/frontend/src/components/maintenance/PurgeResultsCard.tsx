import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../shadcn/table';
import { formatNumber } from '../../utils/formatters';
import type { PurgeResult } from './types';

interface PurgeResultsCardProps {
  results: PurgeResult[];
}

export function PurgeResultsCard({ results }: PurgeResultsCardProps) {
  const { t } = useTranslation(['maintenance', 'common']);

  return (
    <div className="bg-emerald-50 border border-emerald-200 shadow-xl rounded-2xl mt-6">
      <div className="p-6">
        <h2 className="text-lg font-bold text-emerald-600 flex items-center gap-2 mb-4">
          <Trash2 className="size-5" />
          {t('purge_finished')}
        </h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common:table')}</TableHead>
                <TableHead className="text-right">{t('common:rows_deleted')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
               {results.map(r => (
                 <TableRow key={r.key}>
                   <TableCell>{t('tables.' + r.key, r.label)}</TableCell>
                  <TableCell className="text-right font-bold text-emerald-600">{formatNumber(r.deleted)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
