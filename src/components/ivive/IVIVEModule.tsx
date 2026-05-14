// =============================================================================
// IVIVE MODULE — In Vitro / In Vivo Extrapolation
// 2-tab UI: "Inputs & Results" | "Plots"
// =============================================================================

import React, { useState, useCallback, useMemo, useRef } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import * as Switch from '@radix-ui/react-switch';
import {
  FlaskConical,
  Play,
  RotateCcw,
  Save,
  Download,
  Upload,
  FileDown,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  BookOpen,
  BarChart2,
  Sliders,
  X,
} from 'lucide-react';
import clsx from 'clsx';
// @ts-ignore — react-plotly.js has no bundled TS declarations
import Plot from 'react-plotly.js';

import type {
  IVIVEInputs,
  IVIVEModel,
  IVIVESpeciesInputs,
  IVIVECompoundInputs,
  IVIVEPerSpeciesCompound,
  IVIVEResults,
  IVIVESpeciesResult,
  IVIVEModelOutput,
  BatchIVIVERecord,
  BatchIVIVEResult,
  Species,
  Warning,
} from '@/types';

import { runIVIVE } from '@/engine/ivive';
import { runBatchIVIVE } from '@/engine/ivive/batch';
import { IVIVE_MODEL_CONFIGS } from '@/engine/ivive/models';
import { useAppStore } from '@/store';
import { PHYSIOLOGY_DB } from '@/data/physiology';
import { IVIVE_SAMPLE } from '@/data/samples';
import { createRunMetadata } from '@/utils/session';
import { exportJSON, exportCSV, formatNumber } from '@/utils/export';
import { parseFile, iviveCompoundCSVTemplate, parseIVIVECompoundCSV } from '@/utils/csvImport';
import {
  WarningBox,
  EquationPanel,
} from '@/components/shared';
import type { FormulaEntry } from '@/components/shared';

// ---------------------------------------------------------------------------
// Suppress unused-import warnings for types only used in sub-components
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _IVIVESpeciesResult = IVIVESpeciesResult;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _IVIVEModelOutput = IVIVEModelOutput;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SPECIES: Species[] = ['mouse', 'rat', 'rabbit', 'minipig', 'dog', 'monkey', 'human'];

const ALL_MODELS: IVIVEModel[] = [
  'well_stirred_no_binding',
  'well_stirred_with_binding',
  'parallel_tube',
  'poulin_binding_aware',
];

const EXTRACTION_COLORS = {
  low: 'bg-emerald-100 text-emerald-800',
  medium: 'bg-amber-100 text-amber-800',
  high: 'bg-red-100 text-red-800',
} as const;

const IVIVE_FORMULAS: FormulaEntry[] = [
  {
    id: 'scaling_microsomal',
    title: 'CLint Scaling — Microsomal',
    equation: 'CLint_invivo = CLint_mic × MPPGL × LW / 1000',
    variables: [
      { symbol: 'CLint_mic', description: 'Apparent in vitro CLint', units: 'µL/min/mg protein' },
      { symbol: 'MPPGL', description: 'Microsomal protein per gram liver', units: 'mg/g' },
      { symbol: 'LW', description: 'Liver weight', units: 'g' },
      { symbol: 'CLint_invivo', description: 'Scaled whole-liver CLint', units: 'mL/min' },
    ],
    source: 'Houston & Carlile (1997)',
  },
  {
    id: 'scaling_hepatocyte',
    title: 'CLint Scaling — Hepatocyte',
    equation: 'CLint_invivo = CLint_hep × HPGL × LW / 1000',
    variables: [
      { symbol: 'CLint_hep', description: 'Apparent in vitro CLint', units: 'µL/min/10^6 cells' },
      { symbol: 'HPGL', description: 'Hepatocytes per gram liver', units: '10^6 cells/g' },
      { symbol: 'LW', description: 'Liver weight', units: 'g' },
    ],
    source: 'Houston (1994)',
  },
  {
    id: 'fub',
    title: 'Unbound Fraction in Blood (fuB)',
    equation: 'fuB = fup / BP_ratio',
    variables: [
      { symbol: 'fup', description: 'Unbound fraction in plasma', units: '0–1' },
      { symbol: 'BP_ratio', description: 'Blood-to-plasma concentration ratio', units: 'dimensionless' },
      { symbol: 'fuB', description: 'Unbound fraction in blood', units: '0–1' },
    ],
    notes: 'fuB is capped at 1.0 if fup > BP_ratio.',
  },
  {
    id: 'well_stirred_no_binding',
    title: 'Well-Stirred Model (No Binding)',
    equation: 'CLh = Qh × CLint / (Qh + CLint)',
    variables: [
      { symbol: 'Qh', description: 'Hepatic blood flow', units: 'mL/min' },
      { symbol: 'CLint', description: 'Scaled in vivo CLint', units: 'mL/min' },
      { symbol: 'CLh', description: 'Predicted hepatic CL', units: 'mL/min' },
    ],
    assumptions: ['Liver = single well-mixed compartment', 'Blood binding not corrected'],
    source: 'Wilkinson & Shand (1975)',
  },
  {
    id: 'well_stirred_with_binding',
    title: 'Well-Stirred Model (With Binding)',
    equation: 'CLh = Qh × fuB × CLint / (Qh + fuB × CLint)',
    variables: [
      { symbol: 'fuB', description: 'Unbound fraction in blood = fup / BP_ratio', units: '0–1' },
    ],
    assumptions: ['Liver = single well-mixed compartment', 'fuB corrects for blood binding'],
    source: 'Obach (1999) Drug Metab Dispos 27:1350',
  },
  {
    id: 'parallel_tube',
    title: 'Parallel Tube Model',
    equation: 'CLh = Qh × [1 − exp(−fuB × CLint / Qh)]',
    assumptions: [
      'Drug flows through parallel hepatic sinusoids',
      'More accurate than well-stirred for high-extraction compounds',
    ],
    source: 'Pang & Rowland (1977) J Pharmacokinet Biopharm 5:625',
  },
  {
    id: 'poulin_binding_aware',
    title: 'Poulin Binding-Aware Method',
    equation: 'fuB_Poulin = fup / BP_ratio\nCLh = Qh × (fuB_Poulin × CLint) / (Qh + fuB_Poulin × CLint)',
    assumptions: ['BP ratio used as proxy for Kp_blood in the Poulin correction'],
    source: 'Poulin & Theil (2002) J Pharm Sci 91:129',
  },
];

// ---------------------------------------------------------------------------
// Helper: build default species rows
// ---------------------------------------------------------------------------

function buildDefaultSpeciesRow(sp: Species): IVIVESpeciesInputs {
  const phys = PHYSIOLOGY_DB[sp];
  return {
    species: sp,
    label: phys.label,
    bodyWeight_kg: phys.bodyWeight_kg,
    liverWeight_g: phys.liverWeight_g,
    MPPGL: phys.MPPGL,
    HPGL: phys.HPGL,
    Qh_mL_min: phys.hepaticBloodFlow_mL_min,
    include: true,
    overrideLiverWeight: false,
    overrideMPPGL: false,
    overrideHPGL: false,
    overrideQh: false,
  };
}

function buildDefaultCompound(): IVIVECompoundInputs {
  return {
    compound: { name: '' },
    CLint_app: 0,
    CLint_source: 'microsomes',
    fup: 0.1,
    fumic: undefined,
    fuhep: undefined,
    BP_ratio: 1.0,
    apply_fumic_correction: false,
    observed_CLh: undefined,
    CL_units: 'mL/min',
  };
}

function buildDefaultPerSpeciesCompound(sp: Species): IVIVEPerSpeciesCompound {
  return { species: sp, CLint_app: 0, fup: 0.1, BP_ratio: 1.0, observed_CLh: undefined };
}

function buildDefaultInputs(): IVIVEInputs {
  return {
    compound: buildDefaultCompound(),
    perSpeciesCompound: DEFAULT_SPECIES.map(buildDefaultPerSpeciesCompound),
    speciesData: DEFAULT_SPECIES.map(buildDefaultSpeciesRow),
    modelsSelected: ['well_stirred_no_binding', 'well_stirred_with_binding', 'parallel_tube'],
    CLint_units: 'µL/min/mg',
  };
}

// ---------------------------------------------------------------------------
// Batch import helpers
// ---------------------------------------------------------------------------

function validateBatchRecords(records: BatchIVIVERecord[]): string[] {
  const errors: string[] = [];
  records.forEach((rec, i) => {
    const rowNum = i + 2; // +2: 1-based + header row
    if (!(rec.CLint_app > 0)) {
      errors.push(`Row ${rowNum}: CLint_app must be > 0`);
    }
    if (!(rec.fup > 0 && rec.fup <= 1)) {
      errors.push(`Row ${rowNum}: fup must be between 0 and 1 (exclusive)`);
    }
    if (!(rec.BP_ratio > 0)) {
      errors.push(`Row ${rowNum}: blood_to_plasma_ratio must be > 0`);
    }
    if (rec.CLint_source !== 'microsomes' && rec.CLint_source !== 'hepatocytes') {
      errors.push(`Row ${rowNum}: matrix_type must be 'microsomes' or 'hepatocytes'`);
    }
  });
  return errors;
}

function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function buildExportInputsCSV(compound: IVIVECompoundInputs): string {
  const headers =
    'compound_name,matrix_type,CLint_app,CLint_unit,fup,fumic,fuhep,blood_to_plasma_ratio,apply_fumic_correction,observed_CLh,comments';
  const clintUnit =
    compound.CLint_source === 'microsomes' ? 'uL/min/mg' : 'uL/min/1e6cells';
  const row = [
    compound.compound.name,
    compound.CLint_source,
    compound.CLint_app,
    clintUnit,
    compound.fup,
    compound.fumic ?? '',
    compound.fuhep ?? '',
    compound.BP_ratio,
    compound.apply_fumic_correction ? 'true' : 'false',
    compound.observed_CLh ?? '',
    '',
  ].join(',');
  return [headers, row].join('\n');
}

function buildBatchResultsCSV(batchResults: BatchIVIVEResult[]): string {
  const wsModel: IVIVEModel = 'well_stirred_no_binding';
  const headers =
    'compound_name,CLint_app,CLint_source,fup,BP_ratio,human_CLh_well_stirred_mL_min,human_Eh_well_stirred';
  const rows = batchResults.map(r => {
    const humanSr = r.results.speciesResults.find(sr => sr.species === 'human');
    const mo = humanSr?.modelOutputs.find(m => m.model === wsModel);
    return [
      r.compound_name,
      r.inputs.CLint_app,
      r.inputs.CLint_source,
      r.inputs.fup,
      r.inputs.BP_ratio,
      mo ? formatNumber(mo.CLh_predicted) : '',
      mo ? formatNumber(mo.Eh, 3) : '',
    ].join(',');
  });
  return [headers, ...rows].join('\n');
}

// ---------------------------------------------------------------------------
// Sensitivity analysis helper
// ---------------------------------------------------------------------------

interface SensitivityEntry {
  label: string;
  baseCLh: number;
  lowCLh: number;
  highCLh: number;
  delta: number;
}

function computeSensitivity(
  inputs: IVIVEInputs,
  model: IVIVEModel,
  targetSpecies: Species = 'human',
): SensitivityEntry[] {
  const sp = inputs.speciesData.find(s => s.species === targetSpecies && s.include)
    ?? inputs.speciesData.find(s => s.include);
  if (!sp) return [];
  const spDef = sp;

  const perSp = inputs.perSpeciesCompound?.find(p => p.species === spDef.species);
  const baseFup   = perSp?.fup       ?? inputs.compound.fup;
  const baseCLint = perSp?.CLint_app ?? inputs.compound.CLint_app;
  const baseFumic = inputs.compound.fumic;

  function clhFor(
    globalPatch: Partial<IVIVECompoundInputs>,
    perSpPatch?: Partial<IVIVEPerSpeciesCompound>,
    spPatch?: Partial<IVIVESpeciesInputs>,
  ): number {
    const updatedPerSpecies = inputs.perSpeciesCompound?.map(p =>
      p.species === spDef.species ? { ...p, ...(perSpPatch ?? {}) } : p,
    );
    const modInputs: IVIVEInputs = {
      ...inputs,
      compound: { ...inputs.compound, ...globalPatch },
      perSpeciesCompound: updatedPerSpecies,
      speciesData: inputs.speciesData.map(s =>
        s.species === spDef.species ? { ...s, ...(spPatch ?? {}) } : s,
      ),
      modelsSelected: [model],
    };
    const res = runIVIVE(modInputs);
    const sr = res.speciesResults.find(r => r.species === spDef.species);
    if (!sr) return NaN;
    const mo = sr.modelOutputs.find(m => m.model === model);
    return mo?.CLh_predicted ?? NaN;
  }

  const base = clhFor({});
  const entries: SensitivityEntry[] = [];

  // fup ±50%
  const fupLow  = perSp ? clhFor({}, { fup: baseFup * 0.5 }) : clhFor({ fup: baseFup * 0.5 });
  const fupHigh = perSp ? clhFor({}, { fup: baseFup * 1.5 }) : clhFor({ fup: baseFup * 1.5 });
  entries.push({ label: 'fup ±50%', baseCLh: base, lowCLh: fupLow, highCLh: fupHigh, delta: Math.abs(fupHigh - fupLow) });

  // CLint ±50%
  const clLow  = perSp ? clhFor({}, { CLint_app: baseCLint * 0.5 }) : clhFor({ CLint_app: baseCLint * 0.5 });
  const clHigh = perSp ? clhFor({}, { CLint_app: baseCLint * 1.5 }) : clhFor({ CLint_app: baseCLint * 1.5 });
  entries.push({ label: 'CLint ±50%', baseCLh: base, lowCLh: clLow, highCLh: clHigh, delta: Math.abs(clHigh - clLow) });

  // fumic ±50% (if applicable)
  if (inputs.compound.apply_fumic_correction && baseFumic !== undefined) {
    const fmLow  = clhFor({ fumic: baseFumic * 0.5 });
    const fmHigh = clhFor({ fumic: baseFumic * 1.5 });
    entries.push({ label: 'fumic ±50%', baseCLh: base, lowCLh: fmLow, highCLh: fmHigh, delta: Math.abs(fmHigh - fmLow) });
  }

  // BW ±20%
  const bwLow  = clhFor({}, {}, { bodyWeight_kg: sp.bodyWeight_kg * 0.8, liverWeight_g: sp.liverWeight_g * 0.8, Qh_mL_min: sp.Qh_mL_min * 0.8 });
  const bwHigh = clhFor({}, {}, { bodyWeight_kg: sp.bodyWeight_kg * 1.2, liverWeight_g: sp.liverWeight_g * 1.2, Qh_mL_min: sp.Qh_mL_min * 1.2 });
  entries.push({ label: 'BW ±20%', baseCLh: base, lowCLh: bwLow, highCLh: bwHigh, delta: Math.abs(bwHigh - bwLow) });

  return entries.sort((a, b) => b.delta - a.delta);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// ---- Species Table Row ----

interface SpeciesRowProps {
  row: IVIVESpeciesInputs;
  onChange: (r: IVIVESpeciesInputs) => void;
  onResetToDb: () => void;
}

function SpeciesRow({ row, onChange, onResetToDb }: SpeciesRowProps) {
  function set<K extends keyof IVIVESpeciesInputs>(key: K, val: IVIVESpeciesInputs[K]) {
    onChange({ ...row, [key]: val });
  }

  const tdClass = 'px-2 py-1.5 align-middle';
  const inputClass =
    'w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500 disabled:bg-slate-100 disabled:cursor-not-allowed';

  return (
    <tr className={clsx('border-b border-slate-100', !row.include && 'opacity-50')}>
      {/* Include checkbox */}
      <td className={tdClass}>
        <input
          type="checkbox"
          checked={row.include}
          onChange={e => set('include', e.target.checked)}
          className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
        />
      </td>
      {/* Label */}
      <td className={clsx(tdClass, 'text-xs font-medium text-slate-700 whitespace-nowrap')}>{row.label}</td>
      {/* BW_kg */}
      <td className={tdClass}>
        <input
          type="number"
          value={row.bodyWeight_kg}
          min={0}
          step="any"
          disabled={!row.include}
          onChange={e => set('bodyWeight_kg', parseFloat(e.target.value) || row.bodyWeight_kg)}
          className={inputClass}
        />
      </td>
      {/* Liver weight */}
      <td className={tdClass}>
        <input
          type="number"
          value={row.liverWeight_g}
          min={0}
          step="any"
          disabled={!row.include}
          onChange={e => set('liverWeight_g', parseFloat(e.target.value) || row.liverWeight_g)}
          className={inputClass}
        />
      </td>
      {/* MPPGL */}
      <td className={tdClass}>
        <input
          type="number"
          value={row.MPPGL}
          min={0}
          step="any"
          disabled={!row.include}
          onChange={e => set('MPPGL', parseFloat(e.target.value) || row.MPPGL)}
          className={inputClass}
        />
      </td>
      {/* HPGL */}
      <td className={tdClass}>
        <input
          type="number"
          value={row.HPGL}
          min={0}
          step="any"
          disabled={!row.include}
          onChange={e => set('HPGL', parseFloat(e.target.value) || row.HPGL)}
          className={inputClass}
        />
      </td>
      {/* Qh */}
      <td className={tdClass}>
        <input
          type="number"
          value={row.Qh_mL_min}
          min={0}
          step="any"
          disabled={!row.include}
          onChange={e => set('Qh_mL_min', parseFloat(e.target.value) || row.Qh_mL_min)}
          className={inputClass}
        />
      </td>
      {/* Reset */}
      <td className={tdClass}>
        <button
          type="button"
          onClick={onResetToDb}
          disabled={!row.include}
          className="rounded p-1 text-slate-400 hover:text-teal-600 disabled:cursor-not-allowed disabled:opacity-40"
          title="Reset to DB defaults"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ---- Species Table (full-width) ----

interface SpeciesTableProps {
  speciesData: IVIVESpeciesInputs[];
  onSpeciesChange: (updated: IVIVESpeciesInputs) => void;
  onResetSpeciesToDb: (species: Species) => void;
}

function SpeciesTable({ speciesData, onSpeciesChange, onResetSpeciesToDb }: SpeciesTableProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="mb-2">
        <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Species Physiology</h3>
        <p className="text-xs text-slate-500 mt-0.5">Edit physiological parameters per species</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs min-w-[520px]">
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="px-2 py-1.5 text-left font-medium w-6">✓</th>
              <th className="px-2 py-1.5 text-left font-medium">Species</th>
              <th className="px-2 py-1.5 text-left font-medium">BW (kg)</th>
              <th className="px-2 py-1.5 text-left font-medium">LW (g)</th>
              <th className="px-2 py-1.5 text-left font-medium">MPPGL</th>
              <th className="px-2 py-1.5 text-left font-medium">HPGL</th>
              <th className="px-2 py-1.5 text-left font-medium">Qh</th>
              <th className="px-2 py-1.5 text-left font-medium w-8"></th>
            </tr>
          </thead>
          <tbody>
            {speciesData.map(row => (
              <SpeciesRow
                key={row.species}
                row={row}
                onChange={onSpeciesChange}
                onResetToDb={() => onResetSpeciesToDb(row.species)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---- Results Table ----

interface ResultsTableProps {
  results: IVIVEResults;
  modelsSelected: IVIVEModel[];
}

function ResultsTable({ results, modelsSelected }: ResultsTableProps) {
  if (results.speciesResults.length === 0) {
    return <p className="text-sm text-slate-500 italic p-4">No results yet. Run the calculation to see results.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-slate-700 text-white">
            <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Species</th>
            <th className="px-3 py-2 text-right font-medium whitespace-nowrap">CLint_invivo (mL/min)</th>
            <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Qh (mL/min)</th>
            {modelsSelected.map(m => (
              <React.Fragment key={m}>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">
                  {IVIVE_MODEL_CONFIGS[m].label.replace(/\(.*\)/, '').trim()} CLh
                </th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Eh</th>
                <th className="px-3 py-2 text-center font-medium whitespace-nowrap">Category</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Fold Err</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.speciesResults.map((sr, ri) => (
            <tr key={sr.species} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
              <td className="px-3 py-2 font-medium text-slate-800 whitespace-nowrap">{sr.label}</td>
              <td className="px-3 py-2 text-right font-mono text-slate-700">{formatNumber(sr.CLint_invivo)}</td>
              <td className="px-3 py-2 text-right font-mono text-slate-700">{formatNumber(sr.Qh)}</td>
              {modelsSelected.map(m => {
                const mo = sr.modelOutputs.find(o => o.model === m);
                if (!mo) return (
                  <React.Fragment key={m}>
                    <td colSpan={4} className="px-3 py-2 text-center text-slate-400">—</td>
                  </React.Fragment>
                );
                return (
                  <React.Fragment key={m}>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">{formatNumber(mo.CLh_predicted)}</td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">{formatNumber(mo.Eh, 3)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={clsx('rounded-full px-2 py-0.5 text-xs font-semibold', EXTRACTION_COLORS[mo.ExtractionCategory])}>
                        {mo.ExtractionCategory}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-slate-700">
                      {mo.foldError !== undefined ? formatNumber(mo.foldError, 2) : '—'}
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- Plots Panel ----

interface PlotsPanelProps {
  results: IVIVEResults;
  modelsSelected: IVIVEModel[];
}

function PlotsPanel({ results, modelsSelected }: PlotsPanelProps) {
  if (results.speciesResults.length === 0) {
    return <p className="text-sm text-slate-500 italic p-4">Run the calculation to see plots.</p>;
  }

  const speciesLabels = results.speciesResults.map(sr => sr.label);
  const modelColors = ['#0d9488', '#6366f1', '#f59e0b', '#ef4444', '#8b5cf6'];

  // ---- Bar chart: CLh by model per species ----
  const clhBarTraces = modelsSelected.map((m, mi) => ({
    name: IVIVE_MODEL_CONFIGS[m].label,
    type: 'bar' as const,
    x: speciesLabels,
    y: results.speciesResults.map(sr => {
      const mo = sr.modelOutputs.find(o => o.model === m);
      return mo?.CLh_predicted ?? null;
    }),
    marker: { color: modelColors[mi % modelColors.length] },
  }));

  // ---- Extraction ratio bar ----
  const ehTraces = modelsSelected.map((m, mi) => ({
    name: IVIVE_MODEL_CONFIGS[m].label,
    type: 'bar' as const,
    x: speciesLabels,
    y: results.speciesResults.map(sr => {
      const mo = sr.modelOutputs.find(o => o.model === m);
      return mo?.Eh ?? null;
    }),
    marker: { color: modelColors[mi % modelColors.length] },
  }));

  // ---- Observed vs predicted (if observed available) ----
  const hasObserved = results.speciesResults.some(sr =>
    sr.modelOutputs.some(mo => mo.CLobs !== undefined),
  );

  const obsVsPredTraces = hasObserved
    ? modelsSelected.map((m, mi) => {
        const pts = results.speciesResults
          .map(sr => ({ label: sr.label, mo: sr.modelOutputs.find(o => o.model === m) }))
          .filter(p => p.mo?.CLobs !== undefined);
        return {
          name: IVIVE_MODEL_CONFIGS[m].label,
          type: 'scatter' as const,
          mode: 'markers+text' as const,
          x: pts.map(p => p.mo!.CLobs),
          y: pts.map(p => p.mo!.CLh_predicted),
          text: pts.map(p => p.label),
          textposition: 'top center' as const,
          marker: { size: 10, color: modelColors[mi % modelColors.length] },
        };
      })
    : [];

  // Identity line for obs vs pred
  let identityTrace: object | null = null;
  if (hasObserved) {
    const allObs = results.speciesResults.flatMap(sr =>
      sr.modelOutputs.filter(mo => mo.CLobs !== undefined).map(mo => mo.CLobs as number),
    );
    const maxVal = Math.max(...allObs) * 1.2;
    identityTrace = {
      name: 'Identity',
      type: 'scatter',
      mode: 'lines',
      x: [0, maxVal],
      y: [0, maxVal],
      line: { color: '#94a3b8', dash: 'dash', width: 1 },
      showlegend: true,
    };
  }

  const plotLayout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: '#f8fafc',
    font: { size: 11, color: '#334155' },
    legend: { orientation: 'h' as const, y: -0.2 },
    margin: { t: 40, l: 50, r: 20, b: 80 },
  };

  const plotConfig = {
    responsive: true,
    displayModeBar: false,
  };

  return (
    <div className="space-y-6">
      {/* CLh bar chart */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Predicted Hepatic Clearance by Model</h4>
        <Plot
          data={clhBarTraces}
          layout={{
            ...plotLayout,
            barmode: 'group',
            title: '',
            xaxis: { title: 'Species' },
            yaxis: { title: 'CLh (mL/min)' },
            height: 300,
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
      </div>

      {/* Extraction ratio */}
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-semibold text-slate-700 mb-3">Hepatic Extraction Ratio (Eh) by Model</h4>
        <Plot
          data={ehTraces}
          layout={{
            ...plotLayout,
            barmode: 'group',
            title: '',
            xaxis: { title: 'Species' },
            yaxis: { title: 'Eh (0–1)', range: [0, 1] },
            height: 280,
            shapes: [
              { type: 'line', x0: -0.5, x1: speciesLabels.length - 0.5, y0: 0.3, y1: 0.3, line: { color: '#f59e0b', dash: 'dot', width: 1 } },
              { type: 'line', x0: -0.5, x1: speciesLabels.length - 0.5, y0: 0.7, y1: 0.7, line: { color: '#ef4444', dash: 'dot', width: 1 } },
            ],
          }}
          config={plotConfig}
          style={{ width: '100%' }}
        />
        <p className="text-xs text-slate-400 mt-1">Dashed lines: Eh = 0.3 (low/medium) and 0.7 (medium/high)</p>
      </div>

      {/* Observed vs predicted */}
      {hasObserved && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h4 className="text-sm font-semibold text-slate-700 mb-3">Observed vs Predicted CLh</h4>
          <Plot
            data={[...obsVsPredTraces, identityTrace].filter(Boolean) as object[]}
            layout={{
              ...plotLayout,
              title: '',
              xaxis: { title: 'Observed CLh (mL/min)' },
              yaxis: { title: 'Predicted CLh (mL/min)' },
              height: 300,
            }}
            config={plotConfig}
            style={{ width: '100%' }}
          />
        </div>
      )}
    </div>
  );
}

// ---- Sensitivity Panel ----

interface SensitivityPanelProps {
  inputs: IVIVEInputs;
  results: IVIVEResults;
}

function SensitivityPanel({ inputs, results }: SensitivityPanelProps) {
  const [selectedModel, setSelectedModel] = useState<IVIVEModel>(inputs.modelsSelected[0]);

  if (results.speciesResults.length === 0) {
    return <p className="text-sm text-slate-500 italic p-4">Run the calculation first to see sensitivity analysis.</p>;
  }

  const targetSpecies = inputs.speciesData.find(s => s.species === 'human' && s.include)
    ? 'human'
    : (inputs.speciesData.find(s => s.include)?.species ?? 'human');

  const entries = useMemo(
    () => computeSensitivity(inputs, selectedModel, targetSpecies as Species),
    [inputs, selectedModel, targetSpecies],
  );

  if (entries.length === 0) {
    return <p className="text-sm text-slate-500 italic p-4">Could not compute sensitivity for the selected species.</p>;
  }

  const tornadoData = [
    {
      type: 'bar' as const,
      orientation: 'h' as const,
      name: 'Low',
      x: entries.map(e => e.lowCLh - e.baseCLh),
      y: entries.map(e => e.label),
      marker: { color: '#6366f1' },
      base: entries.map(e => e.baseCLh),
    },
    {
      type: 'bar' as const,
      orientation: 'h' as const,
      name: 'High',
      x: entries.map(e => e.highCLh - e.baseCLh),
      y: entries.map(e => e.label),
      marker: { color: '#0d9488' },
      base: entries.map(e => e.baseCLh),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Model selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-medium text-slate-600">Model:</span>
        <div className="flex flex-wrap gap-2">
          {inputs.modelsSelected.map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setSelectedModel(m)}
              className={clsx(
                'rounded border px-2.5 py-1 text-xs font-medium transition-colors',
                selectedModel === m
                  ? 'border-teal-600 bg-teal-600 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              {IVIVE_MODEL_CONFIGS[m].label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Tornado plot for <strong>{targetSpecies}</strong> using <strong>{IVIVE_MODEL_CONFIGS[selectedModel].label}</strong>.
        Bars show CLh deviation from base value when each parameter is varied.
      </p>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <Plot
          data={tornadoData}
          layout={{
            barmode: 'overlay',
            title: `Sensitivity — ${IVIVE_MODEL_CONFIGS[selectedModel].label}`,
            paper_bgcolor: 'transparent',
            plot_bgcolor: '#f8fafc',
            font: { size: 11, color: '#334155' },
            margin: { t: 50, l: 110, r: 30, b: 50 },
            xaxis: { title: 'CLh deviation from base (mL/min)' },
            yaxis: { title: '' },
            height: 280,
            showlegend: true,
            legend: { orientation: 'h', y: -0.2 },
          }}
          config={{ responsive: true, displayModeBar: false }}
          style={{ width: '100%' }}
        />
      </div>

      {/* Numeric summary */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100 text-slate-700">
              <th className="px-3 py-2 text-left font-medium">Parameter</th>
              <th className="px-3 py-2 text-right font-medium">Base CLh (mL/min)</th>
              <th className="px-3 py-2 text-right font-medium">Low CLh</th>
              <th className="px-3 py-2 text-right font-medium">High CLh</th>
              <th className="px-3 py-2 text-right font-medium">Δ Range</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => (
              <tr key={e.label} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-3 py-2 font-medium text-slate-700">{e.label}</td>
                <td className="px-3 py-2 text-right font-mono">{formatNumber(e.baseCLh)}</td>
                <td className="px-3 py-2 text-right font-mono text-indigo-700">{formatNumber(e.lowCLh)}</td>
                <td className="px-3 py-2 text-right font-mono text-teal-700">{formatNumber(e.highCLh)}</td>
                <td className="px-3 py-2 text-right font-mono text-slate-600">{formatNumber(e.delta)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MAIN MODULE
// ---------------------------------------------------------------------------

export default function IVIVEModule() {
  const { setIVIVEInputs, setIVIVEResults, setIVIVERunning, iviveRunning, saveRun } = useAppStore();

  const [inputs, setInputs] = useState<IVIVEInputs>(buildDefaultInputs);
  const [results, setResults] = useState<IVIVEResults | null>(null);
  const [topTab, setTopTab] = useState<'inputs-results' | 'plots'>('inputs-results');
  const [showEquations, setShowEquations] = useState(false);

  // Batch state
  const [batchRecords, setBatchRecords] = useState<BatchIVIVERecord[]>([]);
  const [batchResults, setBatchResults] = useState<BatchIVIVEResult[]>([]);
  const [selectedBatchCompound, setSelectedBatchCompound] = useState<string | null>(null);
  const [batchRunning, setBatchRunning] = useState(false);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Collect all warnings from results
  const allWarnings: Warning[] = useMemo(() => {
    if (!results) return [];
    const ws: Warning[] = [...results.warnings];
    for (const sr of results.speciesResults) {
      ws.push(...sr.warnings);
      for (const mo of sr.modelOutputs) {
        ws.push(...mo.warnings);
      }
    }
    return ws;
  }, [results]);

  // ---- Handlers ----

  const handleCompoundChange = useCallback((c: IVIVECompoundInputs) => {
    setInputs(prev => ({ ...prev, compound: c }));
  }, []);

  const handleSpeciesChange = useCallback((updated: IVIVESpeciesInputs) => {
    setInputs(prev => ({
      ...prev,
      speciesData: prev.speciesData.map(r => r.species === updated.species ? updated : r),
    }));
  }, []);

  const handleResetSpeciesToDb = useCallback((species: Species) => {
    setInputs(prev => ({
      ...prev,
      speciesData: prev.speciesData.map(r =>
        r.species === species ? buildDefaultSpeciesRow(species) : r,
      ),
    }));
  }, []);

  const handleModelToggle = useCallback((m: IVIVEModel, checked: boolean) => {
    setInputs(prev => ({
      ...prev,
      modelsSelected: checked
        ? [...prev.modelsSelected, m]
        : prev.modelsSelected.filter(x => x !== m),
    }));
  }, []);

  const handlePerSpeciesCompoundChange = useCallback((species: Species, patch: Partial<IVIVEPerSpeciesCompound>) => {
    setInputs(prev => ({
      ...prev,
      perSpeciesCompound: (prev.perSpeciesCompound ?? []).map(p =>
        p.species === species ? { ...p, ...patch } : p,
      ),
    }));
  }, []);

  const handleRun = useCallback(() => {
    setIVIVERunning(true);
    try {
      const res = runIVIVE(inputs);
      setResults(res);
      setIVIVEInputs(inputs);
      setIVIVEResults(res);
    } finally {
      setIVIVERunning(false);
    }
  }, [inputs, setIVIVEInputs, setIVIVEResults, setIVIVERunning]);

  const handleReset = useCallback(() => {
    setInputs(buildDefaultInputs());
    setResults(null);
  }, []);

  const handleLoadExample = useCallback(() => {
    setInputs(IVIVE_SAMPLE);
    setResults(null);
  }, []);

  const handleSaveRun = useCallback(() => {
    if (!results) return;
    const sessionResult = {
      metadata: createRunMetadata('ivive'),
      compound: inputs.compound.compound,
      inputs,
      methodsSelected: inputs.modelsSelected,
      intermediateResults: {},
      finalResults: results,
      warnings: allWarnings,
      assumptions: [
        'Microsomal/hepatocyte fraction unbound values are experimentally measured.',
        'Hepatic blood flow values from PHYSIOLOGY_DB (Davies & Morris 1993).',
        'MPPGL/HPGL values from Barter et al. (2007) and Houston & Carlile (1997).',
      ],
      units: {
        CLint_app: inputs.compound.CLint_source === 'microsomes' ? 'µL/min/mg protein' : 'µL/min/10^6 cells',
        CLint_invivo: 'mL/min',
        CLh: 'mL/min',
        Qh: 'mL/min',
      },
    };
    saveRun(sessionResult);
  }, [results, inputs, allWarnings, saveRun]);

  const handleExportJSON = useCallback(() => {
    if (!results) return;
    const sessionResult = {
      metadata: createRunMetadata('ivive'),
      compound: inputs.compound.compound,
      inputs,
      methodsSelected: inputs.modelsSelected,
      intermediateResults: {},
      finalResults: results,
      warnings: allWarnings,
      assumptions: [],
      units: {},
    };
    exportJSON(sessionResult);
  }, [results, inputs, allWarnings]);

  const handleExportCSV = useCallback(() => {
    if (!results) return;
    const rows: Record<string, unknown>[] = [];
    for (const sr of results.speciesResults) {
      for (const mo of sr.modelOutputs) {
        rows.push({
          species: sr.label,
          model: mo.label,
          CLint_invivo_mL_min: formatNumber(sr.CLint_invivo),
          Qh_mL_min: formatNumber(sr.Qh),
          CLh_predicted_mL_min: formatNumber(mo.CLh_predicted),
          CLh_per_kg: formatNumber(mo.CLh_predicted_perKg),
          Eh: formatNumber(mo.Eh, 3),
          ExtractionCategory: mo.ExtractionCategory,
          CLobs: mo.CLobs !== undefined ? formatNumber(mo.CLobs) : '',
          foldError: mo.foldError !== undefined ? formatNumber(mo.foldError, 2) : '',
        });
      }
    }
    exportCSV(rows, `ivive-results-${inputs.compound.compound.name || 'compound'}.csv`);
  }, [results, inputs]);

  // ---- Batch / import handlers ----

  const handleDownloadTemplate = useCallback(() => {
    downloadCSV(iviveCompoundCSVTemplate(), 'ivive-compound-template.csv');
  }, []);

  const handleImportCompounds = useCallback(async (file: File) => {
    setImportErrors([]);
    try {
      const rows = await parseFile(file);
      const records = parseIVIVECompoundCSV(rows);
      const errs = validateBatchRecords(records);
      setImportErrors(errs);
      setBatchRecords(records);
      setSelectedBatchCompound(records.length > 0 ? records[0].compound_name : null);
      setBatchResults([]);
    } catch (e) {
      setImportErrors([e instanceof Error ? e.message : 'Unknown parse error']);
    }
  }, []);

  const handleExportInputs = useCallback(() => {
    downloadCSV(buildExportInputsCSV(inputs.compound), `ivive-inputs-${inputs.compound.compound.name || 'compound'}.csv`);
  }, [inputs.compound]);

  const handleRunBatch = useCallback(() => {
    if (batchRecords.length === 0) return;
    setBatchRunning(true);
    try {
      const batchRes = runBatchIVIVE(batchRecords, inputs.speciesData, inputs.modelsSelected);
      setBatchResults(batchRes);
    } finally {
      setBatchRunning(false);
    }
  }, [batchRecords, inputs.speciesData, inputs.modelsSelected]);

  const handleLoadBatchCompound = useCallback((compoundName: string) => {
    const rec = batchRecords.find(r => r.compound_name === compoundName);
    if (!rec) return;
    setSelectedBatchCompound(compoundName);
    setInputs(prev => ({
      ...prev,
      compound: {
        ...prev.compound,
        compound: { name: rec.compound_name },
        CLint_app: rec.CLint_app,
        CLint_source: rec.CLint_source,
        fup: rec.fup,
        fumic: rec.fumic,
        fuhep: rec.fuhep,
        BP_ratio: rec.BP_ratio,
        apply_fumic_correction: rec.apply_fumic_correction,
        observed_CLh: rec.observed_CLh,
      },
      // Apply same compound params to all per-species rows
      perSpeciesCompound: (prev.perSpeciesCompound ?? []).map(p => ({
        ...p,
        CLint_app: rec.CLint_app,
        fup: rec.fup,
        BP_ratio: rec.BP_ratio,
        observed_CLh: rec.observed_CLh,
      })),
    }));
  }, [batchRecords]);

  const handleClearBatch = useCallback(() => {
    setBatchRecords([]);
    setBatchResults([]);
    setSelectedBatchCompound(null);
    setImportErrors([]);
  }, []);

  const handleExportBatchResults = useCallback(() => {
    if (batchResults.length === 0) return;
    downloadCSV(buildBatchResultsCSV(batchResults), 'ivive-batch-results.csv');
  }, [batchResults]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const hasResults = results !== null && results.speciesResults.length > 0;

  return (
    <div className="min-h-full bg-slate-50">
      {/* ---- Module header ---- */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 shadow-sm">
              <FlaskConical className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">IVIVE</h1>
              <p className="text-xs text-slate-500">In Vitro / In Vivo Extrapolation of hepatic clearance</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Hidden file input for CSV/XLSX import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) void handleImportCompounds(file);
                e.target.value = '';
              }}
            />
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <FileDown className="h-3.5 w-3.5" />
              Download Template
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Import Compounds
            </button>
            <button
              type="button"
              onClick={handleExportInputs}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Export Inputs
            </button>
            <button
              type="button"
              onClick={handleLoadExample}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <BookOpen className="h-3.5 w-3.5" />
              Load Example
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
            {hasResults && (
              <>
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </button>
                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  JSON
                </button>
                <button
                  type="button"
                  onClick={handleSaveRun}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-teal-500 bg-teal-50 px-3 py-1.5 text-xs font-medium text-teal-700 hover:bg-teal-100 transition-colors"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Run
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleRun}
              disabled={iviveRunning || inputs.modelsSelected.length === 0}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1',
                iviveRunning || inputs.modelsSelected.length === 0
                  ? 'cursor-not-allowed bg-slate-200 text-slate-500'
                  : 'bg-teal-600 text-white hover:bg-teal-700 active:bg-teal-800',
              )}
            >
              <Play className="h-3.5 w-3.5" />
              {iviveRunning ? 'Running…' : 'Run IVIVE'}
            </button>
          </div>
        </div>
      </div>

      {/* ---- 2-tab layout ---- */}
      <Tabs.Root
        value={topTab}
        onValueChange={v => setTopTab(v as typeof topTab)}
        className="max-w-screen-2xl mx-auto"
      >
        {/* Tab list bar */}
        <div className="bg-white border-b border-slate-200 px-4">
          <Tabs.List className="flex gap-0" aria-label="IVIVE sections">
            <Tabs.Trigger
              value="inputs-results"
              className="px-5 py-3 text-sm font-medium text-slate-500 border-b-2 border-transparent hover:text-slate-800 hover:border-slate-300 transition-colors data-[state=active]:text-teal-700 data-[state=active]:border-teal-600 focus:outline-none"
            >
              Inputs &amp; Results
            </Tabs.Trigger>
            <Tabs.Trigger
              value="plots"
              className="px-5 py-3 text-sm font-medium text-slate-500 border-b-2 border-transparent hover:text-slate-800 hover:border-slate-300 transition-colors data-[state=active]:text-teal-700 data-[state=active]:border-teal-600 focus:outline-none"
            >
              <span className="flex items-center gap-1.5">
                <BarChart2 className="h-3.5 w-3.5" />
                Plots
              </span>
            </Tabs.Trigger>
          </Tabs.List>
        </div>

        {/* ===== Tab 1: Inputs & Results ===== */}
        <Tabs.Content value="inputs-results" className="p-4 space-y-4 focus:outline-none">

          {/* ── 1. Compound inputs + model selection ── */}
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Compound &amp; Model Settings</h3>

            {/* Shared fields row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              {/* Compound Name */}
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">Compound Name</label>
                <input
                  type="text"
                  value={inputs.compound.compound.name}
                  onChange={e => handleCompoundChange({ ...inputs.compound, compound: { ...inputs.compound.compound, name: e.target.value } })}
                  placeholder="e.g. Compound A"
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>

              {/* CLint Source */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">CLint Source</label>
                <div className="flex gap-1 h-[34px]">
                  {(['microsomes', 'hepatocytes'] as const).map(src => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => handleCompoundChange({ ...inputs.compound, CLint_source: src })}
                      className={clsx(
                        'flex-1 rounded border px-1 py-1 text-[10px] font-medium capitalize transition-colors',
                        inputs.compound.CLint_source === src
                          ? 'border-teal-600 bg-teal-600 text-white'
                          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
                      )}
                    >
                      {src === 'microsomes' ? 'Microsomes' : 'Hepatocytes'}
                    </button>
                  ))}
                </div>
              </div>

              {/* fumic / fuhep */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">
                  {inputs.compound.CLint_source === 'microsomes' ? 'fumic' : 'fuhep'}
                  <span className="text-slate-400 font-normal"> (0–1)</span>
                </label>
                <input
                  type="number" min={0} max={1} step={0.01}
                  value={(inputs.compound.CLint_source === 'microsomes' ? inputs.compound.fumic : inputs.compound.fuhep) ?? ''}
                  onChange={e => {
                    const v = e.target.value === '' ? undefined : parseFloat(e.target.value);
                    handleCompoundChange(inputs.compound.CLint_source === 'microsomes'
                      ? { ...inputs.compound, fumic: v }
                      : { ...inputs.compound, fuhep: v });
                  }}
                  className="rounded border border-slate-300 px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  placeholder="optional"
                />
              </div>
            </div>

            {/* fumic correction toggle */}
            <div className="mb-3 flex items-center gap-2">
              <Switch.Root
                checked={inputs.compound.apply_fumic_correction}
                onCheckedChange={v => handleCompoundChange({ ...inputs.compound, apply_fumic_correction: v })}
                className={clsx(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                  inputs.compound.apply_fumic_correction ? 'bg-teal-600' : 'bg-slate-300',
                )}
              >
                <Switch.Thumb className={clsx(
                  'pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transition-transform',
                  inputs.compound.apply_fumic_correction ? 'translate-x-4' : 'translate-x-0',
                )} />
              </Switch.Root>
              <span className="text-xs font-medium text-slate-600">
                Apply {inputs.compound.CLint_source === 'microsomes' ? 'fumic' : 'fuhep'} correction
              </span>
            </div>

            {/* Per-species compound parameters table */}
            <div className="mb-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Per-Species Compound Parameters
                <span className="ml-2 text-slate-400 font-normal normal-case">
                  (CLint_app in {inputs.compound.CLint_source === 'microsomes' ? 'µL/min/mg protein' : 'µL/min/10⁶ cells'})
                </span>
              </p>
              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600">
                      <th className="px-3 py-1.5 text-left font-medium whitespace-nowrap">Species</th>
                      <th className="px-3 py-1.5 text-left font-medium whitespace-nowrap">CLint_app</th>
                      <th className="px-3 py-1.5 text-left font-medium whitespace-nowrap">fup (0–1)</th>
                      <th className="px-3 py-1.5 text-left font-medium whitespace-nowrap">BP ratio</th>
                      <th className="px-3 py-1.5 text-left font-medium whitespace-nowrap">Obs. CLh (mL/min)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inputs.speciesData.map((spRow, ri) => {
                      const psc = inputs.perSpeciesCompound?.find(p => p.species === spRow.species);
                      const inputClass = clsx(
                        'w-full rounded border px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-teal-500',
                        !spRow.include ? 'border-slate-200 bg-slate-50 text-slate-400' : 'border-slate-300 bg-white',
                      );
                      return (
                        <tr key={spRow.species} className={clsx('border-b border-slate-100 last:border-0', ri % 2 === 0 ? 'bg-white' : 'bg-slate-50/50', !spRow.include && 'opacity-60')}>
                          <td className="px-3 py-1.5 font-medium text-slate-700 whitespace-nowrap">{spRow.label}</td>
                          <td className="px-2 py-1 w-28">
                            <input
                              type="number" min={0} step="any"
                              value={psc?.CLint_app ?? ''}
                              disabled={!spRow.include}
                              onChange={e => handlePerSpeciesCompoundChange(spRow.species, { CLint_app: parseFloat(e.target.value) || 0 })}
                              className={inputClass}
                              placeholder="—"
                            />
                          </td>
                          <td className="px-2 py-1 w-24">
                            <input
                              type="number" min={0} max={1} step={0.01}
                              value={psc?.fup ?? ''}
                              disabled={!spRow.include}
                              onChange={e => handlePerSpeciesCompoundChange(spRow.species, { fup: parseFloat(e.target.value) || 0.1 })}
                              className={inputClass}
                              placeholder="—"
                            />
                          </td>
                          <td className="px-2 py-1 w-24">
                            <input
                              type="number" min={0.1} step={0.05}
                              value={psc?.BP_ratio ?? ''}
                              disabled={!spRow.include}
                              onChange={e => handlePerSpeciesCompoundChange(spRow.species, { BP_ratio: parseFloat(e.target.value) || 1 })}
                              className={inputClass}
                              placeholder="—"
                            />
                          </td>
                          <td className="px-2 py-1 w-32">
                            <input
                              type="number" min={0} step="any"
                              value={psc?.observed_CLh ?? ''}
                              disabled={!spRow.include}
                              onChange={e => handlePerSpeciesCompoundChange(spRow.species, { observed_CLh: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                              className={inputClass}
                              placeholder="optional"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Model checkboxes */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Models:</span>
              {ALL_MODELS.map(m => {
                const cfg = IVIVE_MODEL_CONFIGS[m];
                const checked = inputs.modelsSelected.includes(m);
                return (
                  <label key={m} className="flex items-center gap-1.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={e => handleModelToggle(m, e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                    />
                    <span className={clsx('text-xs font-medium transition-colors', checked ? 'text-teal-700' : 'text-slate-600 group-hover:text-slate-800')}>
                      {cfg.label.replace(/\s*\(.*?\)\s*/g, '').trim()}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* ── 2. Batch import panel (full width, only when records loaded) ── */}
          {batchRecords.length > 0 && (
            <div className="bg-amber-50 rounded-lg border border-amber-200">
              <div className="px-4 py-2.5 flex items-center justify-between border-b border-amber-200">
                <span className="text-xs font-semibold text-amber-800">
                  Batch Import — {batchRecords.length} compound{batchRecords.length !== 1 ? 's' : ''}
                </span>
                <button type="button" onClick={handleClearBatch}
                  className="rounded p-0.5 text-amber-500 hover:text-amber-700" title="Clear batch">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="text-xs text-amber-700 font-medium whitespace-nowrap">Load compound:</label>
                  <select
                    value={selectedBatchCompound ?? ''}
                    onChange={e => handleLoadBatchCompound(e.target.value)}
                    className="rounded border border-amber-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {batchRecords.map(r => (
                      <option key={r.compound_name} value={r.compound_name}>{r.compound_name}</option>
                    ))}
                  </select>
                  <button type="button" onClick={handleRunBatch} disabled={batchRunning}
                    className="flex items-center gap-1.5 rounded border border-amber-400 bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200 disabled:opacity-50">
                    <RefreshCw className={clsx('h-3 w-3', batchRunning && 'animate-spin')} />
                    {batchRunning ? 'Running…' : 'Run All'}
                  </button>
                  {batchResults.length > 0 && (
                    <button type="button" onClick={handleExportBatchResults}
                      className="flex items-center gap-1.5 rounded border border-amber-400 bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200">
                      <FileDown className="h-3 w-3" /> Export Results
                    </button>
                  )}
                </div>
                {/* Compact batch summary table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-amber-100 text-amber-800">
                        <th className="px-2 py-1 text-left font-medium">Compound</th>
                        <th className="px-2 py-1 text-right font-medium">CLint_app</th>
                        <th className="px-2 py-1 text-right font-medium">fup</th>
                        <th className="px-2 py-1 text-left font-medium">Matrix</th>
                        <th className="px-2 py-1 text-right font-medium">CLh (human, WS)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batchRecords.map((r, i) => {
                        const batchRes = batchResults.find(br => br.compound_name === r.compound_name);
                        const humanRes = batchRes?.results.humanResult?.modelOutputs.find(o => o.model === 'well_stirred_with_binding');
                        return (
                          <tr key={r.compound_name}
                            className={clsx('cursor-pointer hover:bg-amber-100 transition-colors', i % 2 === 0 ? 'bg-white' : 'bg-amber-50')}
                            onClick={() => handleLoadBatchCompound(r.compound_name)}>
                            <td className="px-2 py-1 font-medium text-slate-800">{r.compound_name}</td>
                            <td className="px-2 py-1 text-right font-mono">{r.CLint_app}</td>
                            <td className="px-2 py-1 text-right font-mono">{r.fup}</td>
                            <td className="px-2 py-1">{r.CLint_source}</td>
                            <td className="px-2 py-1 text-right font-mono">{humanRes ? formatNumber(humanRes.CLh_predicted) : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {importErrors.length > 0 && (
                  <ul className="space-y-0.5">
                    {importErrors.map((err, i) => <li key={i} className="text-xs text-red-600">{err}</li>)}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Import errors (parse failure, no records loaded) */}
          {batchRecords.length === 0 && importErrors.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <ul className="space-y-0.5">
                {importErrors.map((err, i) => <li key={i} className="text-xs text-red-600">{err}</li>)}
              </ul>
            </div>
          )}

          {/* ── 3. Species physiology table — full width ── */}
          <SpeciesTable
            speciesData={inputs.speciesData}
            onSpeciesChange={handleSpeciesChange}
            onResetSpeciesToDb={handleResetSpeciesToDb}
          />

          {/* ── 4. Results — full width ── */}
          {hasResults && results ? (
            <div className="space-y-4">
              {/* Human summary cards */}
              {results.humanResult && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {results.humanResult.modelOutputs.map(mo => (
                    <div key={mo.model} className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="text-xs font-medium text-slate-500 leading-tight mb-1">{mo.label}</p>
                      <p className="text-lg font-bold text-teal-700 font-mono">{formatNumber(mo.CLh_predicted)}</p>
                      <p className="text-xs text-slate-400">mL/min (human)</p>
                      <span className={clsx('mt-1 inline-block rounded-full px-1.5 py-0.5 text-xs font-semibold', EXTRACTION_COLORS[mo.ExtractionCategory])}>
                        {mo.ExtractionCategory}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Full-width results table */}
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3">Results by Species &amp; Model</h3>
                <ResultsTable results={results} modelsSelected={inputs.modelsSelected} />
              </div>

              {/* Full-width sensitivity analysis */}
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-teal-600" />
                  Sensitivity Analysis
                </h3>
                <SensitivityPanel inputs={inputs} results={results} />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 bg-white rounded-lg border border-dashed border-slate-300">
              <FlaskConical className="h-8 w-8 mb-2 text-slate-300" />
              <p className="text-sm font-medium">Results will appear here after running</p>
            </div>
          )}

          {/* ── 5. Warnings ── */}
          {allWarnings.length > 0 && (
            <WarningBox warnings={allWarnings} title="Computation Notices" collapsible />
          )}

          {/* ── 6. Equations accordion — collapsible, at the bottom ── */}
          <div className="bg-white rounded-lg border border-slate-200">
            <button type="button" onClick={() => setShowEquations(v => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 transition-colors rounded-lg">
              <span className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-teal-600" />
                Model Equations Reference
              </span>
              {showEquations ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showEquations && (
              <div className="px-4 pb-4 border-t border-slate-100">
                <EquationPanel formulas={IVIVE_FORMULAS} />
              </div>
            )}
          </div>

        </Tabs.Content>

        {/* ===== Tab 2: Plots ===== */}
        <Tabs.Content value="plots" className="p-4 focus:outline-none">
          <div className="bg-white rounded-lg border border-slate-200 p-4">
            {hasResults && results ? (
              <PlotsPanel results={results} modelsSelected={inputs.modelsSelected} />
            ) : (
              <div className="flex flex-col items-center justify-center h-96 text-slate-400">
                <BarChart2 className="h-12 w-12 mb-3 text-slate-300" />
                <p className="text-sm font-medium">Graphs will appear after running the analysis</p>
                <p className="text-xs mt-1">
                  Configure inputs and click <strong>Run IVIVE</strong>
                </p>
              </div>
            )}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
