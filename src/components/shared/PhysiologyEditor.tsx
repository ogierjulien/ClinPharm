import React, { useState, useCallback } from 'react';
import clsx from 'clsx';
import { RotateCcw } from 'lucide-react';
import { SpeciesPhysiology } from '@/types';
import { PHYSIOLOGY_DB } from '@/data/physiology';

interface PhysiologyEditorProps {
  species: SpeciesPhysiology[];
  onChange: (updated: SpeciesPhysiology[]) => void;
}

interface EditableField {
  key: keyof SpeciesPhysiology;
  header: string;
  unit: string;
}

const EDITABLE_FIELDS: EditableField[] = [
  { key: 'bodyWeight_kg',                 header: 'BW',     unit: 'kg'          },
  { key: 'liverWeight_g',                 header: 'Liver W', unit: 'g'          },
  { key: 'MPPGL',                         header: 'MPPGL',  unit: 'mg/g'        },
  { key: 'HPGL',                          header: 'HPGL',   unit: '10⁶ cells/g' },
  { key: 'hepaticBloodFlow_mL_min',       header: 'Qh',     unit: 'mL/min'      },
  { key: 'MLP_years',                     header: 'MLP',    unit: 'yr'          },
  { key: 'brainWeight_g',                 header: 'Brain W', unit: 'g'          },
];

function formatNumber(val: unknown): string {
  if (val === null || val === undefined) return '';
  const n = Number(val);
  if (isNaN(n)) return '';
  // Show up to 4 significant figures
  if (Math.abs(n) >= 1000) return n.toFixed(0);
  if (Math.abs(n) >= 100) return n.toFixed(1);
  if (Math.abs(n) >= 10) return n.toFixed(2);
  if (Math.abs(n) >= 1) return n.toFixed(3);
  return n.toPrecision(3);
}

interface CellProps {
  value: number | undefined;
  onChange: (val: number | undefined) => void;
}

function EditableCell({ value, onChange }: CellProps) {
  const [focused, setFocused] = useState(false);
  const [raw, setRaw] = useState('');

  const handleFocus = () => {
    setFocused(true);
    setRaw(value !== undefined ? String(value) : '');
  };

  const handleBlur = () => {
    setFocused(false);
    const parsed = parseFloat(raw);
    onChange(isNaN(parsed) ? undefined : parsed);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRaw(e.target.value);
  };

  return (
    <input
      type="number"
      className={clsx(
        'w-full text-right text-xs bg-transparent border-0 outline-none',
        'focus:bg-white focus:ring-1 focus:ring-indigo-400 rounded px-1 py-0.5',
        'hover:bg-slate-50 transition-colors',
      )}
      value={focused ? raw : formatNumber(value)}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={handleChange}
      step="any"
      min={0}
    />
  );
}

export default function PhysiologyEditor({ species, onChange }: PhysiologyEditorProps) {
  const handleCellChange = useCallback(
    (rowIdx: number, field: keyof SpeciesPhysiology, val: number | undefined) => {
      const updated = species.map((sp, i) => {
        if (i !== rowIdx) return sp;
        return { ...sp, [field]: val };
      });
      onChange(updated);
    },
    [species, onChange],
  );

  const handleReset = useCallback(() => {
    const defaults = species.map((sp) => {
      const db = PHYSIOLOGY_DB[sp.species];
      return db ? { ...db } : { ...sp };
    });
    onChange(defaults);
  }, [species, onChange]);

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-200">
        <p className="text-sm font-semibold text-slate-700">Species Physiological Parameters</p>
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset to defaults
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="sci-table">
          <thead>
            <tr>
              <th className="text-left w-28">Species</th>
              {EDITABLE_FIELDS.map((f) => (
                <th key={f.key} className="text-right">
                  <div>{f.header}</div>
                  <div className="font-normal normal-case tracking-normal opacity-70">({f.unit})</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {species.map((sp, rowIdx) => (
              <tr key={`${sp.species}-${rowIdx}`}>
                <td className="font-medium text-slate-700 whitespace-nowrap">{sp.label}</td>
                {EDITABLE_FIELDS.map((f) => (
                  <td key={f.key} className="p-0.5">
                    <EditableCell
                      value={sp[f.key] as number | undefined}
                      onChange={(val) => handleCellChange(rowIdx, f.key, val)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200">
        <p className="text-xs text-slate-500">
          Click any cell to edit. Values sourced from Davies &amp; Morris 1993, Barter et al. 2007.
        </p>
      </div>
    </div>
  );
}
