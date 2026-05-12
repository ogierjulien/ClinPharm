import React, { useState } from 'react';
import { PlusCircle, Trash2, Upload, Download } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import type { AnimalDataPoint, Species } from '@/types';
import { PHYSIOLOGY_DB, SPECIES_LABELS } from '@/data/physiology';
import { parseFile, parseAllometryCSV, allometryCSVTemplate } from '@/utils/csvImport';
import { exportCSV } from '@/utils/export';

interface Props {
  data: AnimalDataPoint[];
  onChange: (data: AnimalDataPoint[]) => void;
  showBrainWeight?: boolean;
  showMLP?: boolean;
}

const SPECIES_OPTIONS: Species[] = [
  'mouse', 'rat', 'rabbit', 'guinea_pig', 'hamster',
  'dog', 'monkey', 'cynomolgus_monkey', 'rhesus_monkey', 'minipig', 'custom',
];

function NumCell({
  value, onChange, step = 'any', min,
}: {
  value: number | undefined; onChange: (v: number) => void; step?: string | number; min?: number;
}) {
  return (
    <input
      type="number"
      step={step}
      min={min ?? 0}
      value={value ?? ''}
      onChange={e => onChange(parseFloat(e.target.value))}
      className="w-full px-2 py-1 text-right text-sm border border-transparent rounded focus:border-indigo-400 focus:outline-none focus:bg-white bg-transparent"
    />
  );
}

export default function SpeciesInputTable({ data, onChange, showBrainWeight = false, showMLP = false }: Props) {
  const [uploading, setUploading] = useState(false);

  function updateRow(id: string, patch: Partial<AnimalDataPoint>) {
    onChange(data.map(row => (row.id === id ? { ...row, ...patch } : row)));
  }

  function updateRowAndDeriveAbs(id: string, patch: Partial<AnimalDataPoint>, rowSnapshot: AnimalDataPoint) {
    const merged = { ...rowSnapshot, ...patch };
    const BW = merged.bodyWeight_kg ?? 0;
    const CL_abs = merged.CL_perKg_input ? merged.CL_observed * BW : merged.CL_observed;
    const Vss_abs = merged.Vss_perKg_input ? merged.Vss_observed * BW : merged.Vss_observed;
    onChange(data.map(row => (row.id === id ? { ...merged, CL_abs, Vss_abs } : row)));
  }

  function addRow() {
    const phys = PHYSIOLOGY_DB['rat'];
    onChange([
      ...data,
      {
        id: uuidv4(),
        species: 'rat',
        label: 'Rat',
        bodyWeight_kg: phys.bodyWeight_kg,
        CL_observed: 0,
        Vss_observed: 0,
        fup: undefined,
        brainWeight_g: phys.brainWeight_g,
        MLP_years: phys.MLP_years,
        include: true,
        CL_perKg_input: false,
        Vss_perKg_input: false,
        CL_abs: 0,
        Vss_abs: 0,
      },
    ]);
  }

  function removeRow(id: string) {
    onChange(data.filter(row => row.id !== id));
  }

  function toggleInclude(id: string) {
    onChange(data.map(row => (row.id === id ? { ...row, include: !row.include } : row)));
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const rows = await parseFile(file);
      const parsed = parseAllometryCSV(rows);
      onChange([...data, ...parsed]);
    } catch (err) {
      alert(`Import error: ${(err as Error).message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function downloadTemplate() {
    const csv = allometryCSVTemplate();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'allometry-input-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCurrentData() {
    exportCSV(
      data.map(d => ({
        species: d.species,
        label: d.label,
        body_weight_kg: d.bodyWeight_kg,
        CL: d.CL_observed,
        Vss: d.Vss_observed,
        fup: d.fup ?? '',
        brain_weight_g: d.brainWeight_g ?? '',
        MLP_years: d.MLP_years ?? '',
        CL_perkg: d.CL_perKg_input ?? false,
        include: d.include,
      })),
      'allometry-input.csv'
    );
  }

  function onSpeciesChange(id: string, species: Species, row: AnimalDataPoint) {
    const phys = PHYSIOLOGY_DB[species];
    if (phys) {
      updateRow(id, {
        species,
        label: SPECIES_LABELS[species] ?? String(species),
        bodyWeight_kg: phys.bodyWeight_kg,
        brainWeight_g: phys.brainWeight_g,
        MLP_years: phys.MLP_years,
      });
    } else {
      updateRow(id, { species, label: String(species) });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-slate-700">Animal Data</h3>
        <div className="flex gap-2">
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 transition-colors"
            title="Download CSV template"
          >
            <Download size={13} /> Template
          </button>
          <label className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 transition-colors cursor-pointer" title="Import CSV/XLSX">
            <Upload size={13} /> {uploading ? 'Importing…' : 'Import'}
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
          </label>
          <button
            onClick={exportCurrentData}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <Download size={13} /> Export
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="sci-table text-xs whitespace-nowrap">
          <thead>
            <tr>
              <th className="w-8">✓</th>
              <th>Species</th>
              <th>Label</th>
              <th>BW (kg)</th>
              <th>CL</th>
              <th>Vss</th>
              <th>fup</th>
              <th>per-kg?</th>
              {showBrainWeight && <th>BrW (g)</th>}
              {showMLP && <th>MLP (yr)</th>}
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {data.map(row => (
              <tr key={row.id} className={!row.include ? 'opacity-40 line-through' : ''}>
                <td className="text-center">
                  <input
                    type="checkbox"
                    checked={row.include}
                    onChange={() => toggleInclude(row.id)}
                    className="accent-indigo-600"
                  />
                </td>
                <td>
                  <select
                    value={row.species}
                    onChange={e => onSpeciesChange(row.id, e.target.value as Species, row)}
                    className="text-xs border-0 bg-transparent focus:outline-none focus:ring-1 focus:ring-indigo-400 rounded px-1"
                  >
                    {SPECIES_OPTIONS.map(s => (
                      <option key={s} value={s}>{SPECIES_LABELS[s] ?? s}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="text"
                    value={row.label}
                    onChange={e => updateRow(row.id, { label: e.target.value })}
                    className="w-24 px-2 py-1 text-sm border border-transparent rounded focus:border-indigo-400 focus:outline-none focus:bg-white bg-transparent"
                  />
                </td>
                <td>
                  <NumCell
                    value={row.bodyWeight_kg}
                    onChange={v => updateRowAndDeriveAbs(row.id, { bodyWeight_kg: v }, row)}
                    step={0.001}
                  />
                </td>
                <td>
                  <NumCell
                    value={row.CL_observed}
                    onChange={v => updateRowAndDeriveAbs(row.id, { CL_observed: v }, row)}
                  />
                </td>
                <td>
                  <NumCell
                    value={row.Vss_observed}
                    onChange={v => updateRowAndDeriveAbs(row.id, { Vss_observed: v }, row)}
                  />
                </td>
                <td>
                  <NumCell
                    value={row.fup}
                    onChange={v => updateRow(row.id, { fup: v })}
                    step={0.01}
                  />
                </td>
                <td className="text-center">
                  <input
                    type="checkbox"
                    checked={!!row.CL_perKg_input}
                    onChange={e => updateRowAndDeriveAbs(row.id, { CL_perKg_input: e.target.checked, Vss_perKg_input: e.target.checked }, row)}
                    className="accent-indigo-600"
                    title="Values entered as per-kg"
                  />
                </td>
                {showBrainWeight && (
                  <td>
                    <NumCell
                      value={row.brainWeight_g}
                      onChange={v => updateRow(row.id, { brainWeight_g: v })}
                    />
                  </td>
                )}
                {showMLP && (
                  <td>
                    <NumCell
                      value={row.MLP_years}
                      onChange={v => updateRow(row.id, { MLP_years: v })}
                    />
                  </td>
                )}
                <td>
                  <button onClick={() => removeRow(row.id)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        onClick={addRow}
        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors mt-1"
      >
        <PlusCircle size={14} /> Add species row
      </button>

      <p className="text-xs text-slate-400 mt-1">
        CL units: mL/min (absolute) or mL/min/kg (check per-kg). Vss: L or L/kg.
      </p>
    </div>
  );
}
