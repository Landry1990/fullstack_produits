import { useTranslation } from 'react-i18next';
import { Eye } from 'lucide-react';
import { Badge } from '../shadcn/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../shadcn/table';
import { formatNumber } from '../../utils/formatters';
import type { PreviewResult } from './types';

interface PreviewResultsCardProps {
  preview: PreviewResult[];
  totalCount: number;
}

export function PreviewResultsCard({ preview, totalCount }: PreviewResultsCardProps) {
  const { t } = useTranslation(['maintenance', 'common']);

  return (
    <div className="bg-white shadow-xl rounded-2xl border border-slate-200 mt-6">
      <div className="p-6">
        <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Eye className="size-5 text-blue-600" />
          {t('preview_title', { count: totalCount })}
        </h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common:table')}</TableHead>
                <TableHead className="text-right">{t('common:rows')}</TableHead>
                <TableHead>{t('common:sub_tables')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
               {preview.map(p => (
                 <TableRow key={p.key}>
                   <TableCell className="font-medium">{t('tables.' + p.key, p.label)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={p.count > 0 ? 'destructive' : 'secondary'} className="text-xs">
                      {formatNumber(p.count)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.children.length > 0 ? (
                      <div className="flex gap-2 flex-wrap">
                         {p.children.map((c) => (
                           <Badge key={c.label} variant="outline" className="text-xs">
                             {t('tables.children.' + c.label.toLowerCase().replace(/ /g, '_').normalize("NFD").replace(/[\u0300-\u036f]/g, ""), c.label)}: {formatNumber(c.count)}
                           </Badge>
                         ))}
                      </div>
                    ) : (
                      <span className="text-slate-300 text-xs">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
