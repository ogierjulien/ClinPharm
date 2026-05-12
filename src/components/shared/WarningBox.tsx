import React, { useState } from 'react';
import clsx from 'clsx';
import { Info, AlertTriangle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Warning } from '@/types';

interface WarningBoxProps {
  warnings: Warning[];
  title?: string;
  collapsible?: boolean;
}

const severityConfig = {
  info: {
    icon: Info,
    containerClass: 'warn-info border',
    iconClass: 'text-blue-500',
  },
  caution: {
    icon: AlertTriangle,
    containerClass: 'warn-caution border',
    iconClass: 'text-yellow-500',
  },
  warning: {
    icon: AlertTriangle,
    containerClass: 'warn-warning border',
    iconClass: 'text-orange-500',
  },
  error: {
    icon: XCircle,
    containerClass: 'warn-error border',
    iconClass: 'text-red-500',
  },
} as const;

function WarningItem({ warning }: { warning: Warning }) {
  const config = severityConfig[warning.severity];
  const Icon = config.icon;

  return (
    <div
      className={clsx(
        'flex items-start gap-2.5 rounded-md px-3 py-2.5 text-sm',
        config.containerClass,
      )}
    >
      <Icon className={clsx('h-4 w-4 mt-0.5 shrink-0', config.iconClass)} aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-medium leading-snug">{warning.message}</p>
        {warning.field && (
          <p className="text-xs mt-0.5 opacity-75">Field: {warning.field}</p>
        )}
        {warning.code && (
          <p className="text-xs mt-0.5 opacity-60 font-mono">{warning.code}</p>
        )}
      </div>
    </div>
  );
}

export default function WarningBox({ warnings, title, collapsible = false }: WarningBoxProps) {
  const [expanded, setExpanded] = useState(true);

  if (!warnings || warnings.length === 0) return null;

  // Sort by severity: error > warning > caution > info
  const severityOrder = { error: 0, warning: 1, caution: 2, info: 3 };
  const sorted = [...warnings].sort(
    (a, b) => severityOrder[a.severity] - severityOrder[b.severity],
  );

  const highestSeverity = sorted[0].severity;
  const config = severityConfig[highestSeverity];
  const Icon = config.icon;

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div
        className={clsx(
          'flex items-center justify-between px-4 py-2.5',
          collapsible && 'cursor-pointer select-none',
          config.containerClass,
        )}
        onClick={collapsible ? () => setExpanded((e) => !e) : undefined}
        role={collapsible ? 'button' : undefined}
        aria-expanded={collapsible ? expanded : undefined}
      >
        <div className="flex items-center gap-2">
          <Icon className={clsx('h-4 w-4 shrink-0', config.iconClass)} aria-hidden="true" />
          <span className="text-sm font-semibold">
            {title ?? 'Notices'} ({warnings.length})
          </span>
        </div>
        {collapsible && (
          <span className="ml-2">
            {expanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
        )}
      </div>

      {(!collapsible || expanded) && (
        <div className="flex flex-col gap-2 p-3">
          {sorted.map((w, i) => (
            <WarningItem key={`${w.code}-${i}`} warning={w} />
          ))}
        </div>
      )}
    </div>
  );
}
