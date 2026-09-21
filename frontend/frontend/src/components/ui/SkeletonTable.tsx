import React from 'react';

interface SkeletonTableProps {
  rows?: number;
  columns?: number;
}

/** @deprecated Utiliser l'équivalent shadcn dans components/shadcn/ — conservé pour compatibilité */
export default function SkeletonTable({ rows = 5, columns = 5 }: SkeletonTableProps) {
  return (
    <div className="w-full space-y-4 animate-pulse">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800">
              {Array.from({ length: columns }).map((_, i) => (
                <th key={i}>
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-16 mx-auto"></div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex}>
                    <div className={`h-4 bg-slate-100 dark:bg-slate-800 rounded ${colIndex === 1 ? 'w-32' : 'w-16'} mx-auto`}></div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
