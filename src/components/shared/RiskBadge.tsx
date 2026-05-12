import React from 'react';
import clsx from 'clsx';
import { DDIRiskLevel } from '@/types';

interface RiskBadgeProps {
  risk: DDIRiskLevel;
  label?: string;
}

const riskConfig: Record<DDIRiskLevel, { text: string; classes: string }> = {
  no_risk: {
    text: 'No Risk',
    classes: 'bg-green-100 text-green-800 ring-1 ring-green-300',
  },
  potential_risk: {
    text: 'Potential Risk',
    classes: 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-300',
  },
  risk: {
    text: 'Risk',
    classes: 'bg-orange-100 text-orange-800 ring-1 ring-orange-300',
  },
  high_risk: {
    text: 'High Risk',
    classes: 'bg-red-100 text-red-800 ring-1 ring-red-300',
  },
};

export default function RiskBadge({ risk, label }: RiskBadgeProps) {
  const config = riskConfig[risk];
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        config.classes,
      )}
    >
      {label ?? config.text}
    </span>
  );
}
