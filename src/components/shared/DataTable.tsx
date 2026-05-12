import React, { useState, useCallback } from 'react';
import clsx from 'clsx';
import { ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';

export interface Column {
  key: string;
  header: string;
  render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'right' | 'center';
}

interface DataTableProps {
  columns: Column[];
  data: Record<string, unknown>[];
  exportable?: boolean;
  caption?: string;
  className?: string;
}

type SortDirection = 'asc' | 'desc' | null;

function exportToCSV(columns: Column[], data: Record<string, unknown>[], filename: string) {
  const headers = columns.map((c) => JSON.stringify(c.header)).join(',');
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const val = row[col.key];
        if (val === null || val === undefined) return '';
        return JSON.stringify(String(val));
      })
      .join(','),
  );
  const csv = [headers, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function DataTable({
  columns,
  data,
  exportable = false,
  caption,
  className,
}: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey !== key) {
        setSortKey(key);
        setSortDir('asc');
      } else if (sortDir === 'asc') {
        setSortDir('desc');
      } else {
        setSortKey(null);
        setSortDir(null);
      }
    },
    [sortKey, sortDir],
  );

  const sortedData = React.useMemo(() => {
    if (!sortKey || !sortDir) return data;
    return [...data].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const aNum = Number(aVal);
      const bNum = Number(bVal);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
      }
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return sortDir === 'asc' ? -1 : 1;
      if (aStr > bStr) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  const alignClass = (align?: 'left' | 'right' | 'center') => {
    if (align === 'right') return 'text-right';
    if (align === 'center') return 'text-center';
    return 'text-left';
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortKey !== colKey)
      return <ArrowUpDown className="h-3 w-3 text-slate-400 ml-1 inline" />;
    if (sortDir === 'asc') return <ArrowUp className="h-3 w-3 text-indigo-300 ml-1 inline" />;
    return <ArrowDown className="h-3 w-3 text-indigo-300 ml-1 inline" />;
  };

  return (
    <div className={clsx('rounded-lg border border-slate-200 overflow-hidden', className)}>
      {(caption || exportable) && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          {caption && (
            <p className="text-sm font-medium text-slate-700">{caption}</p>
          )}
          {exportable && (
            <button
              type="button"
              onClick={() =>
                exportToCSV(columns, data, `${caption ?? 'export'}.csv`)
              }
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors ml-auto"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        {sortedData.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-slate-400">No data available.</div>
        ) : (
          <table className="sci-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={col.width ? { width: col.width } : undefined}
                    className={clsx(alignClass(col.align), col.sortable && 'cursor-pointer select-none hover:bg-slate-600')}
                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  >
                    <span className="inline-flex items-center">
                      {col.header}
                      {col.sortable && <SortIcon colKey={col.key} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedData.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {columns.map((col) => {
                    const rawValue = row[col.key];
                    return (
                      <td
                        key={col.key}
                        className={clsx(alignClass(col.align))}
                      >
                        {col.render
                          ? col.render(rawValue, row)
                          : rawValue === null || rawValue === undefined
                          ? <span className="text-slate-400">—</span>
                          : String(rawValue)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
