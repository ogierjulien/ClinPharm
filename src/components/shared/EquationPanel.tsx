import React from 'react';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown, BookOpen } from 'lucide-react';
import clsx from 'clsx';

// Locally defined since FormulaEntry is not in @/types
export interface VariableDefinition {
  symbol: string;
  description: string;
  units?: string;
}

export interface FormulaEntry {
  id: string;
  title: string;
  equation: string;          // primary equation string (plain-text/monospace)
  variables?: VariableDefinition[];
  assumptions?: string[];
  source?: string;
  citation?: string;
  notes?: string;
}

interface EquationPanelProps {
  formulas: FormulaEntry[];
  title?: string;
}

function VariablesTable({ variables }: { variables: VariableDefinition[] }) {
  return (
    <table className="sci-table mt-2 text-xs">
      <thead>
        <tr>
          <th className="w-20">Symbol</th>
          <th>Description</th>
          <th className="w-28">Units</th>
        </tr>
      </thead>
      <tbody>
        {variables.map((v) => (
          <tr key={v.symbol}>
            <td className="font-mono font-semibold">{v.symbol}</td>
            <td>{v.description}</td>
            <td className="font-mono text-slate-500">{v.units ?? '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function EquationPanel({ formulas, title }: EquationPanelProps) {
  if (!formulas || formulas.length === 0) return null;

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 overflow-hidden">
      {title && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-indigo-200 bg-indigo-100">
          <BookOpen className="h-4 w-4 text-indigo-600" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-indigo-900">{title}</h3>
        </div>
      )}

      <Accordion.Root type="multiple" className="divide-y divide-indigo-200">
        {formulas.map((formula) => (
          <Accordion.Item key={formula.id} value={formula.id}>
            <Accordion.Header>
              <Accordion.Trigger
                className={clsx(
                  'group flex w-full items-center justify-between px-4 py-3',
                  'text-sm font-medium text-indigo-900 hover:bg-indigo-100 transition-colors',
                  'data-[state=open]:bg-indigo-100',
                )}
              >
                <span>{formula.title}</span>
                <ChevronDown
                  className="h-4 w-4 text-indigo-600 transition-transform duration-200 group-data-[state=open]:rotate-180"
                  aria-hidden="true"
                />
              </Accordion.Trigger>
            </Accordion.Header>

            <Accordion.Content className="overflow-hidden data-[state=open]:animate-none data-[state=closed]:animate-none">
              <div className="px-4 pb-4 pt-1 space-y-3">
                {/* Primary equation */}
                <div className="equation-block">
                  {formula.equation}
                </div>

                {/* Variables */}
                {formula.variables && formula.variables.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                      Variable Definitions
                    </p>
                    <VariablesTable variables={formula.variables} />
                  </div>
                )}

                {/* Assumptions */}
                {formula.assumptions && formula.assumptions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
                      Assumptions
                    </p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {formula.assumptions.map((a, i) => (
                        <li key={i} className="text-xs text-slate-600">
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Notes */}
                {formula.notes && (
                  <p className="text-xs text-slate-500 italic">{formula.notes}</p>
                )}

                {/* Source / Citation */}
                {(formula.source || formula.citation) && (
                  <div className="text-xs text-slate-500 border-t border-indigo-200 pt-2">
                    {formula.source && (
                      <span className="font-medium text-slate-600">Source: </span>
                    )}
                    {formula.source}
                    {formula.citation && (
                      <span className="ml-1 italic">{formula.citation}</span>
                    )}
                  </div>
                )}
              </div>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </div>
  );
}
