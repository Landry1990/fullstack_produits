import type { ReactNode } from 'react';

export interface ReportTableColumn {
  key: string;
  label: ReactNode;
  align?: 'left' | 'right';
}

export function ReportTableHead({ columns }: { columns: ReportTableColumn[] }) {
  return (
    <thead>
      <tr className="bg-slate-50 text-label font-black text-slate-400 uppercase tracking-widest">
        {columns.map((col, i) => (
          <th
            key={col.key}
            className={`py-3 border-b border-slate-200 ${col.align === 'left' ? 'text-left' : 'text-right'}${i === 0 ? ' pl-4' : ''}${i === columns.length - 1 ? ' pr-4' : ''}`}
          >
            {col.label}
          </th>
        ))}
      </tr>
    </thead>
  );
}
