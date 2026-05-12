import React, { useState, useCallback, useMemo, useRef } from 'react';
// @ts-ignore
import Plot from 'react-plotly.js';
import * as Tabs from '@radix-ui/react-tabs';
import {
  Play,
  RotateCcw,
  Save,
  Download,
  BookOpen,
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Upload,
} from 'lucide-react';
import clsx from 'clsx';

import type {
  DDIInputs,
  DDIResults,
  CYPEnzyme,
  NonCYPPhase1Enzyme,
  UGTEnzyme,
  Phase2OtherEnzyme,
  DrugMetabolizingEnzyme,
  Transporter,
  SubstratePathway,
  ReversibleInhibitorData,
  TDIData,
  InductionData,
  TransporterInhibitionData,
  DDIRiskLevel,
  Warning,
  MechanisticStaticEnzymeInputs,
  MechanisticStaticResults,
  MMKineticsEntry,
} from '@/types';
import { deriveMMCLint } from '@/engine/ddi/mmKinetics';

import { useAppStore } from '@/store';
import { runDDI } from '@/engine/ddi';
import { computeMechanisticStatic } from '@/engine/ddi/mechanisticStatic';
import { DDI_SAMPLE } from '@/data/samples/ddi';
import { PHYSIOLOGY_DB } from '@/data/physiology';
import { createRunMetadata } from '@/utils/session';
import { exportJSON } from '@/utils/export';
import { WarningBox, RiskBadge } from '@/components/shared';
import { ddiCSVTemplate, parseDDIBatchCSV, parseFile } from '@/utils/csvImport';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Primary CYP enzymes — regulatory focus per ICH M12
const CYP_ENZYMES_PRIMARY: CYPEnzyme[] = [
  'CYP1A2', 'CYP2B6', 'CYP2C8', 'CYP2C9', 'CYP2C19', 'CYP2D6', 'CYP3A4', 'CYP3A5',
];
// Additional CYP enzymes per ICH M12 Section 3.2
const CYP_ENZYMES_ADDITIONAL: CYPEnzyme[] = ['CYP2A6', 'CYP2E1', 'CYP2J2', 'CYP4F2'];

// All CYP enzymes (used for inhibition tabs)
const CYP_ENZYMES: CYPEnzyme[] = [...CYP_ENZYMES_PRIMARY, ...CYP_ENZYMES_ADDITIONAL, 'other'];

// Phase 1 non-CYP enzymes — ICH M12 Section 3.2
const NON_CYP_PHASE1_ENZYMES: NonCYPPhase1Enzyme[] = [
  'ADH', 'ALDH', 'AO', 'CES1', 'CES2', 'FMO', 'MAO-A', 'MAO-B', 'XO',
];

// UGT enzymes — ICH M12 Section 3.3
const UGT_ENZYMES: UGTEnzyme[] = [
  'UGT1A1', 'UGT1A3', 'UGT1A4', 'UGT1A6', 'UGT1A9', 'UGT1A10',
  'UGT2B4', 'UGT2B7', 'UGT2B10', 'UGT2B15', 'UGT2B17',
];

// Other Phase 2 enzymes — ICH M12 Section 3.3
const PHASE2_OTHER_ENZYMES: Phase2OtherEnzyme[] = [
  'GST', 'NAT1', 'NAT2', 'SULT1A1', 'SULT1A2', 'SULT2A1',
];

// CYP enzymes eligible for induction (CYP1A2 via AhR; CYP2B6/3A4 via PXR)
// + UGTs induced via same NR pathways (UGT1A1 via AhR/PXR; UGT1A4/2B7 via PXR)
const CYP_INDUCTION_ENZYMES: CYPEnzyme[] = ['CYP1A2', 'CYP2B6', 'CYP3A4'];
const UGT_INDUCTION_ENZYMES: UGTEnzyme[] = ['UGT1A1', 'UGT1A4', 'UGT2B7'];

// UGTs targeted for TDI assessment (most common victims of MBI-like inhibition)
const UGT_TDI_ENZYMES: UGTEnzyme[] = ['UGT1A1', 'UGT2B7'];

// All transporters per ICH M12 — grouped by function
const TRANSPORTERS_EFFLUX: Transporter[]       = ['P-gp', 'BCRP', 'MRP2'];
const TRANSPORTERS_HEPATIC: Transporter[]       = ['OATP1B1', 'OATP1B3', 'OCT1', 'NTCP'];
const TRANSPORTERS_RENAL: Transporter[]         = ['OAT1', 'OAT2', 'OAT3', 'OCT2', 'MATE1', 'MATE2K'];
const TRANSPORTERS_BILIARY: Transporter[]       = ['BSEP'];
const TRANSPORTERS: Transporter[] = [
  ...TRANSPORTERS_EFFLUX,
  ...TRANSPORTERS_HEPATIC,
  ...TRANSPORTERS_RENAL,
  ...TRANSPORTERS_BILIARY,
];

// Transporters that use gut-lumen concentration (intestinal efflux)
const INTESTINAL_TRANSPORTERS: Transporter[] = ['P-gp', 'BCRP'];
// Transporters that use hepatic inlet concentration
const HEPATIC_INLET_TRANSPORTERS: Transporter[] = ['OATP1B1', 'OATP1B3', 'OCT1'];

const human = PHYSIOLOGY_DB.human;

// Enzyme degradation rate constants (h⁻¹) — from physiology DB or literature defaults
const HUMAN_KDEG: Record<string, number> = {
  // Primary CYPs (Yang et al. 2008, Obach et al. 2006)
  CYP1A2:  human.kdeg_CYP1A2  ?? 0.0208,
  CYP2B6:  human.kdeg_CYP2B6  ?? 0.0096,
  CYP2C8:  human.kdeg_CYP2C8  ?? 0.0213,
  CYP2C9:  human.kdeg_CYP2C9  ?? 0.0148,
  CYP2C19: human.kdeg_CYP2C19 ?? 0.0148,
  CYP2D6:  human.kdeg_CYP2D6  ?? 0.0088,
  CYP3A4:  human.kdeg_CYP3A4  ?? 0.0193,
  CYP3A5:  human.kdeg_CYP3A4  ?? 0.0193,
  // Additional CYPs (use CYP3A4 range as approximation)
  CYP2A6:  0.0150,
  CYP2E1:  0.0210,
  CYP2J2:  0.0193,
  CYP4F2:  0.0150,
  other:   0.0200,
  // UGTs — Shen et al. 2016 DMPK; consensus ~0.0226 h⁻¹
  UGT1A1:  0.0226,
  UGT1A4:  0.0226,
  UGT2B7:  0.0226,
  UGT1A3:  0.0226,
  UGT1A6:  0.0226,
  UGT1A9:  0.0226,
  UGT1A10: 0.0226,
  UGT2B4:  0.0226,
  UGT2B10: 0.0226,
  UGT2B15: 0.0226,
  UGT2B17: 0.0226,
};

const MECHANISM_OPTIONS = [
  { value: 'competitive',     label: 'Competitive' },
  { value: 'non_competitive', label: 'Non-competitive' },
  { value: 'uncompetitive',   label: 'Uncompetitive' },
  { value: 'mixed',           label: 'Mixed' },
  { value: 'unknown',         label: 'Unknown' },
] as const;

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

type TabId = 'substrate' | 'reversible' | 'tdi' | 'induction' | 'transporters' | 'mechanistic';

const TABS: { id: TabId; label: string; shortLabel: string }[] = [
  { id: 'substrate',    label: 'Substrate Assessment',       shortLabel: 'Substrate' },
  { id: 'reversible',   label: 'Reversible Inhibition',      shortLabel: 'Rev. Inhib.' },
  { id: 'tdi',          label: 'Time-Dependent Inhibition',  shortLabel: 'TDI' },
  { id: 'induction',    label: 'Induction',                  shortLabel: 'Induction' },
  { id: 'transporters', label: 'Transporters',               shortLabel: 'Transport.' },
  { id: 'mechanistic',  label: 'Mechanistic Static',         shortLabel: 'Mech. Static' },
];

// ---------------------------------------------------------------------------
// Risk colour helpers
// ---------------------------------------------------------------------------

const RISK_BG: Record<DDIRiskLevel, string> = {
  no_risk:       'bg-green-100 text-green-800',
  potential_risk:'bg-yellow-100 text-yellow-800',
  risk:          'bg-orange-100 text-orange-800',
  high_risk:     'bg-red-100 text-red-800',
};

const RISK_CELL: Record<DDIRiskLevel, string> = {
  no_risk:       'bg-green-50',
  potential_risk:'bg-yellow-50',
  risk:          'bg-orange-50',
  high_risk:     'bg-red-50',
};

const RISK_LABEL: Record<DDIRiskLevel, string> = {
  no_risk:       'No Risk',
  potential_risk:'Potential',
  risk:          'Risk',
  high_risk:     'High Risk',
};

// ---------------------------------------------------------------------------
// Blank-state builders
// ---------------------------------------------------------------------------

function blankSubstratePaths(): SubstratePathway[] {
  const all: DrugMetabolizingEnzyme[] = [
    ...CYP_ENZYMES_PRIMARY,
    ...CYP_ENZYMES_ADDITIONAL,
    'other',
    ...NON_CYP_PHASE1_ENZYMES,
    ...UGT_ENZYMES,
    ...PHASE2_OTHER_ENZYMES,
  ];
  return all.map(e => ({ enzyme: e, fm: 0 }));
}

function blankReversible(): ReversibleInhibitorData[] {
  const all: (DrugMetabolizingEnzyme)[] = [
    ...CYP_ENZYMES_PRIMARY,
    ...CYP_ENZYMES_ADDITIONAL,
    'other',
    ...NON_CYP_PHASE1_ENZYMES,
    ...UGT_ENZYMES,
    ...PHASE2_OTHER_ENZYMES,
  ];
  return all.map(e => ({
    enzyme: e,
    Ki: undefined,
    IC50: undefined,
    Iu_max: undefined,
    mechanism: 'unknown' as const,
    IC50_to_Ki_ratio: 2,
  }));
}

function blankTDI(): TDIData[] {
  // TDI primarily applies to CYPs and select UGTs
  const tdiEnzymes: DrugMetabolizingEnzyme[] = [
    ...CYP_ENZYMES_PRIMARY,
    ...CYP_ENZYMES_ADDITIONAL,
    'other',
    ...UGT_TDI_ENZYMES,
  ];
  return tdiEnzymes.map(e => ({
    enzyme: e,
    kinact: 0,
    KI: 1,
    Iu_max: 0,
    kdeg: HUMAN_KDEG[e] ?? 0.02,
  }));
}

function blankInduction(): InductionData[] {
  const indEnzymes: DrugMetabolizingEnzyme[] = [
    ...CYP_INDUCTION_ENZYMES,
    ...UGT_INDUCTION_ENZYMES,
  ];
  return indEnzymes.map(e => ({
    enzyme: e,
    Emax: 0,
    EC50: 1,
    Iu_max: 0,
    d: 1,
  }));
}

function blankTransporters(): TransporterInhibitionData[] {
  return TRANSPORTERS.map(t => ({
    transporter: t,
    IC50: undefined,
    Ki: undefined,
    Iu_gut: undefined,
    Iu_systemic: undefined,
  }));
}

function blankInputs(): DDIInputs {
  return {
    compound: { name: '' },
    substratePathways: blankSubstratePaths(),
    mmKinetics: [],
    reversibleInhibitors: blankReversible(),
    tdiData: blankTDI(),
    induction: blankInduction(),
    transporterInhibition: blankTransporters(),
    Cmax_total: undefined,
    Cmax_unbound: undefined,
    fup: undefined,
    dose_mg: undefined,
    bioavailability_F: undefined,
    dosingInterval_h: undefined,
    useInletConcentration: false,
    fabs: undefined,
    Qgut_mL_min: 18,
  };
}

// Merge sample DDI data into the blank template (fill only provided entries)
function sampleToInputs(sample: DDIInputs): DDIInputs {
  const base = blankInputs();

  // substrate pathways — fill matching enzymes
  const spMap = new Map(sample.substratePathways.map(p => [p.enzyme, p]));
  base.substratePathways = base.substratePathways.map(p =>
    spMap.has(p.enzyme) ? { ...p, ...spMap.get(p.enzyme) } : p,
  );

  // reversible inhibitors
  const revMap = new Map(sample.reversibleInhibitors.map(r => [r.enzyme, r]));
  base.reversibleInhibitors = base.reversibleInhibitors.map(r =>
    revMap.has(r.enzyme) ? { ...r, ...revMap.get(r.enzyme) } : r,
  );

  // TDI
  const tdiMap = new Map(sample.tdiData.map(t => [t.enzyme, t]));
  base.tdiData = base.tdiData.map(t =>
    tdiMap.has(t.enzyme) ? { ...t, ...tdiMap.get(t.enzyme) } : t,
  );

  // Induction
  const indMap = new Map(sample.induction.map(i => [i.enzyme, i]));
  base.induction = base.induction.map(i =>
    indMap.has(i.enzyme) ? { ...i, ...indMap.get(i.enzyme) } : i,
  );

  // Transporters
  const trMap = new Map(sample.transporterInhibition.map(t => [t.transporter, t]));
  base.transporterInhibition = base.transporterInhibition.map(t =>
    trMap.has(t.transporter) ? { ...t, ...trMap.get(t.transporter) } : t,
  );

  return {
    ...base,
    compound: sample.compound,
    mmKinetics:        sample.mmKinetics ?? [],
    Cmax_total:        sample.Cmax_total,
    Cmax_unbound:      sample.Cmax_unbound,
    fup:               sample.fup,
    dose_mg:           sample.dose_mg,
    bioavailability_F: sample.bioavailability_F,
    dosingInterval_h:  sample.dosingInterval_h,
    useInletConcentration: sample.useInletConcentration,
    fabs:              sample.fabs,
    Qgut_mL_min:       sample.Qgut_mL_min,
  };
}

// ---------------------------------------------------------------------------
// Small inline helpers
// ---------------------------------------------------------------------------

function fmt(v: number | undefined | null, dp = 3): string {
  if (v === undefined || v === null || isNaN(v)) return '—';
  if (!isFinite(v)) return '∞';
  if (Math.abs(v) >= 10000 || (Math.abs(v) < 0.0001 && v !== 0)) return v.toExponential(2);
  return v.toFixed(dp);
}

function NumCell({ v, dp = 3 }: { v: number | undefined | null; dp?: number }) {
  return <span className="font-mono text-xs">{fmt(v, dp)}</span>;
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline numeric input used in tables
// ---------------------------------------------------------------------------

interface CellInputProps {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: string;
  className?: string;
}

function CellInput({ value, onChange, placeholder = '—', min, max, step = 'any', className }: CellInputProps) {
  return (
    <input
      type="number"
      className={clsx(
        'w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs font-mono',
        'focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500',
        'placeholder-slate-300 text-slate-800',
        className,
      )}
      value={value === undefined ? '' : value}
      onChange={e => {
        const raw = e.target.value;
        if (raw === '' || raw === '-') { onChange(undefined); return; }
        const n = parseFloat(raw);
        onChange(isNaN(n) ? undefined : n);
      }}
      placeholder={placeholder}
      min={min}
      max={max}
      step={step}
    />
  );
}

// ---------------------------------------------------------------------------
// Tab A — Substrate Assessment (ICH M12 full enzyme scope)
// ---------------------------------------------------------------------------

// Enzyme group definitions for display grouping
const SUBSTRATE_GROUPS: { label: string; color: string; enzymes: DrugMetabolizingEnzyme[] }[] = [
  {
    label: 'Primary CYP Enzymes',
    color: 'bg-blue-50 text-blue-800',
    enzymes: CYP_ENZYMES_PRIMARY,
  },
  {
    label: 'Additional CYP Enzymes (ICH M12)',
    color: 'bg-indigo-50 text-indigo-800',
    enzymes: CYP_ENZYMES_ADDITIONAL,
  },
  {
    label: 'Phase 1 Non-CYP Enzymes (ICH M12)',
    color: 'bg-purple-50 text-purple-800',
    enzymes: NON_CYP_PHASE1_ENZYMES,
  },
  {
    label: 'UGT Enzymes — Phase 2 (ICH M12)',
    color: 'bg-emerald-50 text-emerald-800',
    enzymes: UGT_ENZYMES,
  },
  {
    label: 'Other Phase 2 Enzymes (ICH M12)',
    color: 'bg-slate-100 text-slate-700',
    enzymes: PHASE2_OTHER_ENZYMES,
  },
  {
    label: 'Other',
    color: 'bg-slate-50 text-slate-600',
    enzymes: ['other'],
  },
];

interface SubstrateTabProps {
  pathways: SubstratePathway[];
  mmKinetics: MMKineticsEntry[];
  onChange: (p: SubstratePathway[]) => void;
  onMMChange: (entries: MMKineticsEntry[]) => void;
}

function SubstrateTab({ pathways, mmKinetics, onChange, onMMChange }: SubstrateTabProps) {
  const [showMM, setShowMM] = React.useState(false);

  const totalFm = pathways.reduce((s, p) => s + (p.fm ?? 0), 0);
  const sumError = totalFm > 1.0001;

  function updateFm(enzyme: string, v: number | undefined) {
    const next = pathways.map(p => String(p.enzyme) === enzyme ? { ...p, fm: v ?? 0 } : p);
    onChange(next);
  }

  function addMMEntry() {
    const newEntry: MMKineticsEntry = {
      id: `mm-${Date.now()}`,
      enzyme: '',
      Km: 0,
      Vmax: 0,
      units: 'microsomes',
    };
    onMMChange([...mmKinetics, newEntry]);
  }

  function updateMMEntry(id: string, patch: Partial<MMKineticsEntry>) {
    const updated = mmKinetics.map(e => e.id === id ? { ...e, ...patch } : e);
    const derived = deriveMMCLint(updated);
    onMMChange(derived);
  }

  function removeMMEntry(id: string) {
    onMMChange(mmKinetics.filter(e => e.id !== id));
  }

  function renderEnzymeRow(p: SubstratePathway, rowIdx: number) {
    const fm = p.fm ?? 0;
    const aucrMax = fm >= 1 ? Infinity : fm > 0 ? 1 / (1 - fm) : 1;
    const isSensitive = fm >= 0.8;
    const isMajor     = fm >= 0.5;
    const isModerate  = fm >= 0.25 && !isMajor;

    const risk: DDIRiskLevel =
      isSensitive ? 'high_risk'
      : isMajor   ? 'risk'
      : isModerate ? 'potential_risk'
      : 'no_risk';

    const label =
      isSensitive  ? 'Sensitive substrate'
      : isMajor    ? 'Major substrate'
      : isModerate ? 'Moderate substrate'
      : 'Minor substrate';

    return (
      <tr key={String(p.enzyme)} className={clsx('border-b border-slate-100 last:border-0', rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
        <td className="px-3 py-1.5 font-mono font-semibold text-slate-700 text-xs">{String(p.enzyme)}</td>
        <td className="px-3 py-1.5">
          <CellInput value={fm === 0 ? undefined : fm} onChange={v => updateFm(String(p.enzyme), v)} placeholder="0" min={0} max={1} />
        </td>
        <td className={clsx('px-3 py-1.5 text-right font-mono text-xs', fm > 0 ? 'text-slate-800' : 'text-slate-300')}>
          {fm > 0 ? (isFinite(aucrMax) ? aucrMax.toFixed(2) : '∞') : '—'}
        </td>
        <td className="px-3 py-1.5 text-center text-xs">
          {isSensitive ? <span className="text-red-600 font-bold">✓</span> : <span className="text-slate-200">—</span>}
        </td>
        <td className="px-3 py-1.5 text-center text-xs">
          {isMajor ? <span className="text-orange-500 font-bold">✓</span> : <span className="text-slate-200">—</span>}
        </td>
        <td className="px-3 py-1.5">
          {fm > 0 ? <RiskBadge risk={risk} label={label} /> : <span className="text-slate-300 text-xs">—</span>}
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Substrate Pathway Assessment (ICH M12)"
        subtitle="Enter fraction metabolised (fm) per enzyme. Values should sum to ≤ 1.0 across all pathways."
      />

      {sumError && (
        <div className="flex items-center gap-2 rounded-md bg-orange-50 border border-orange-200 px-3 py-2 text-xs text-orange-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-orange-500" />
          <span>Sum of fm = <strong>{totalFm.toFixed(3)}</strong> — exceeds 1.0. Check fractions.</span>
        </div>
      )}

      {/* Enzyme table with group headers */}
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">Enzyme</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-36">fm (0–1)</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600">AUCR max</th>
              <th className="text-center px-3 py-2 font-semibold text-slate-600">Sensitive</th>
              <th className="text-center px-3 py-2 font-semibold text-slate-600">Major</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600">Classification</th>
            </tr>
          </thead>
          <tbody>
            {SUBSTRATE_GROUPS.map(group => {
              const groupPathways = pathways.filter(p => group.enzymes.includes(p.enzyme as DrugMetabolizingEnzyme));
              return (
                <React.Fragment key={group.label}>
                  <tr>
                    <td colSpan={6} className={clsx('px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider', group.color)}>
                      {group.label}
                    </td>
                  </tr>
                  {groupPathways.map((p, i) => renderEnzymeRow(p, i))}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-300 bg-slate-100">
              <td className="px-3 py-2 font-semibold text-slate-600 text-xs">Total fm</td>
              <td className={clsx('px-3 py-2 font-mono font-bold text-xs', sumError ? 'text-orange-600' : 'text-slate-700')}>
                {totalFm.toFixed(3)}{sumError && ' ⚠'}
              </td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Sensitive substrate: fm ≥ 0.80 (AUCR ≥ 5); Major: fm ≥ 0.50 (AUCR ≥ 2); Moderate: fm 0.25–0.50 (AUCR 1.33–2).
        ICH M12 (2024); FDA/EMA Guidance. All enzyme groups per ICH M12 Section 3.
      </p>

      {/* ── MM Kinetics panel ── */}
      <div className="rounded-lg border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setShowMM(v => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 rounded-lg transition-colors"
        >
          <span className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
            Michaelis-Menten Kinetics
            <span className="text-slate-400 font-normal normal-case">— CLint = Vmax / Km</span>
          </span>
          <ChevronDown className={clsx('h-4 w-4 transition-transform', showMM && 'rotate-180')} />
        </button>

        {showMM && (
          <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
            <p className="text-xs text-slate-500">
              Enter Km and Vmax for each enzyme from in-vitro assays.
              CLint is derived automatically (corrected for substrate concentration if provided).
              <br />
              <strong>Formula:</strong> CLint = Vmax / (Km + [S]) µL/min/mg (microsomes) or µL/min/10⁶ cells (hepatocytes).
              At [S] ≪ Km: CLint ≈ Vmax / Km.
            </p>

            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-xs min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-3 py-2 font-semibold text-slate-600 w-32">Enzyme / Pathway</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600 w-24">Units</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">Km (µM)</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600 w-32">Vmax (pmol/min/mg)</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">[S] assay (µM)</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-600 w-32">CLint derived</th>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Notes</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {mmKinetics.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-4 text-center text-slate-400">
                        No entries. Click <strong>+ Add enzyme</strong> to begin.
                      </td>
                    </tr>
                  )}
                  {mmKinetics.map((entry, i) => (
                    <tr key={entry.id} className={clsx('border-b border-slate-100', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          value={entry.enzyme}
                          onChange={e => updateMMEntry(entry.id, { enzyme: e.target.value })}
                          placeholder="e.g. CYP3A4"
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          value={entry.units}
                          onChange={e => updateMMEntry(entry.id, { units: e.target.value as 'microsomes' | 'hepatocytes' })}
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none"
                        >
                          <option value="microsomes">Microsomes</option>
                          <option value="hepatocytes">Hepatocytes</option>
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <CellInput value={entry.Km || undefined} onChange={v => updateMMEntry(entry.id, { Km: v ?? 0 })} placeholder="—" min={0} />
                      </td>
                      <td className="px-3 py-1.5">
                        <CellInput value={entry.Vmax || undefined} onChange={v => updateMMEntry(entry.id, { Vmax: v ?? 0 })} placeholder="—" min={0} />
                      </td>
                      <td className="px-3 py-1.5">
                        <CellInput value={entry.substrate_conc} onChange={v => updateMMEntry(entry.id, { substrate_conc: v })} placeholder="≪ Km" min={0} />
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono font-semibold">
                        {entry.CLint_derived !== undefined ? (
                          <span className="text-teal-700">{entry.CLint_derived.toFixed(3)}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <input
                          type="text"
                          value={entry.notes ?? ''}
                          onChange={e => updateMMEntry(entry.id, { notes: e.target.value })}
                          placeholder="Optional note"
                          className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => removeMMEntry(entry.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                          title="Remove row"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              onClick={addMMEntry}
              className="flex items-center gap-1.5 text-xs text-amber-700 border border-amber-300 bg-amber-50 rounded px-3 py-1.5 hover:bg-amber-100 transition-colors"
            >
              + Add enzyme
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab B — Reversible Inhibition (ICH M12 full enzyme scope)
// ---------------------------------------------------------------------------

// Group definitions for reversible inhibition (same enzyme groups as substrate)
const REV_INH_GROUPS: { label: string; color: string; enzymes: DrugMetabolizingEnzyme[] }[] = [
  { label: 'Primary CYP Enzymes',                 color: 'bg-blue-50 text-blue-800',    enzymes: CYP_ENZYMES_PRIMARY },
  { label: 'Additional CYP Enzymes (ICH M12)',    color: 'bg-indigo-50 text-indigo-800', enzymes: CYP_ENZYMES_ADDITIONAL },
  { label: 'Phase 1 Non-CYP Enzymes (ICH M12)',   color: 'bg-purple-50 text-purple-800', enzymes: NON_CYP_PHASE1_ENZYMES },
  { label: 'UGT Enzymes — Phase 2 (ICH M12)',     color: 'bg-emerald-50 text-emerald-800', enzymes: UGT_ENZYMES },
  { label: 'Other Phase 2 Enzymes (ICH M12)',     color: 'bg-slate-100 text-slate-700',  enzymes: PHASE2_OTHER_ENZYMES },
  { label: 'Other',                               color: 'bg-slate-50 text-slate-600',   enzymes: ['other'] },
];

interface ReversibleTabProps {
  inhibitors: ReversibleInhibitorData[];
  onChange: (v: ReversibleInhibitorData[]) => void;
}

function ReversibleTab({ inhibitors, onChange }: ReversibleTabProps) {
  function update(enzyme: string, patch: Partial<ReversibleInhibitorData>) {
    onChange(inhibitors.map(r => String(r.enzyme) === enzyme ? { ...r, ...patch } : r));
  }

  function renderRow(r: ReversibleInhibitorData, rowIdx: number) {
    const Ki_eff = r.Ki !== undefined && r.Ki > 0
      ? r.Ki
      : r.IC50 !== undefined && r.IC50 > 0
        ? r.IC50 / (r.IC50_to_Ki_ratio ?? 2)
        : undefined;

    const Iu = r.Iu_max ?? 0;
    const R1 = Ki_eff !== undefined && Ki_eff > 0 ? 1 + Iu / Ki_eff : undefined;

    const riskEMA: DDIRiskLevel | null = R1 !== undefined
      ? R1 >= 1.02 * 2 ? 'risk' : R1 >= 1.02 ? 'potential_risk' : 'no_risk'
      : null;
    const riskFDA: DDIRiskLevel | null = R1 !== undefined
      ? R1 >= 1.1 * 2 ? 'risk' : R1 >= 1.1 ? 'potential_risk' : 'no_risk'
      : null;

    const enz = String(r.enzyme);
    return (
      <tr key={enz} className={clsx('border-b border-slate-100 last:border-0', rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
        <td className="px-3 py-1.5 font-mono font-semibold text-slate-700 text-xs">{enz}</td>
        <td className="px-3 py-1.5">
          <CellInput value={r.Ki} onChange={v => update(enz, { Ki: v })} placeholder="—" min={0} />
        </td>
        <td className="px-3 py-1.5">
          <CellInput value={r.IC50} onChange={v => update(enz, { IC50: v })} placeholder="—" min={0} />
        </td>
        <td className="px-3 py-1.5">
          <select
            value={r.mechanism}
            onChange={e => update(enz, { mechanism: e.target.value as ReversibleInhibitorData['mechanism'] })}
            className="w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500"
          >
            {MECHANISM_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </td>
        <td className="px-3 py-1.5">
          <CellInput value={r.Iu_max} onChange={v => update(enz, { Iu_max: v })} placeholder="—" min={0} />
        </td>
        <td className="px-3 py-1.5 text-right font-mono text-xs text-slate-800">
          {R1 !== undefined ? <span className={clsx(R1 >= 1.02 ? 'font-bold' : '')}>{R1.toFixed(3)}</span> : <span className="text-slate-300">—</span>}
        </td>
        <td className="px-3 py-1.5 text-center">
          {riskEMA !== null ? <RiskBadge risk={riskEMA} /> : <span className="text-slate-300 text-xs">—</span>}
        </td>
        <td className="px-3 py-1.5 text-center">
          {riskFDA !== null ? <RiskBadge risk={riskFDA} /> : <span className="text-slate-300 text-xs">—</span>}
        </td>
      </tr>
    );
  }

  return (
    <div>
      <SectionHeader
        title="Reversible Inhibition — R1 Ratio (ICH M12)"
        subtitle="Enter Ki or IC50 (µM) and Iu_max (µM) for each enzyme. R1 = 1 + Iu/Ki. ICH M12 covers CYPs, Phase 1 non-CYP, UGTs, and other Phase 2."
      />

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">Enzyme</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">Ki (µM)</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">IC50 (µM)</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-32">Mechanism</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">Iu_max (µM)</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600 w-20">R1</th>
              <th className="text-center px-3 py-2 font-semibold text-slate-600 w-28">EMA (≥1.02)</th>
              <th className="text-center px-3 py-2 font-semibold text-slate-600 w-28">FDA (≥1.1)</th>
            </tr>
          </thead>
          <tbody>
            {REV_INH_GROUPS.map(group => {
              const groupInhibitors = inhibitors.filter(r => group.enzymes.includes(r.enzyme as DrugMetabolizingEnzyme));
              return (
                <React.Fragment key={group.label}>
                  <tr>
                    <td colSpan={8} className={clsx('px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider', group.color)}>
                      {group.label}
                    </td>
                  </tr>
                  {groupInhibitors.map((r, i) => renderRow(r, i))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        R1 = 1 + Iu / Ki. If only IC50 provided, Ki ≈ IC50 / IC50_to_Ki (default 2, competitive).
        EMA threshold R1 ≥ 1.02; FDA threshold R1 ≥ 1.1. ICH M12 (2024) Section 3.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab C — TDI
// ---------------------------------------------------------------------------

interface TDITabProps {
  data: TDIData[];
  onChange: (v: TDIData[]) => void;
}

// TDI enzyme groups (CYPs + select UGTs)
const TDI_GROUPS: { label: string; color: string; enzymes: DrugMetabolizingEnzyme[] }[] = [
  { label: 'Primary CYP Enzymes',              color: 'bg-blue-50 text-blue-800',      enzymes: CYP_ENZYMES_PRIMARY },
  { label: 'Additional CYP Enzymes (ICH M12)', color: 'bg-indigo-50 text-indigo-800',  enzymes: CYP_ENZYMES_ADDITIONAL },
  { label: 'UGTs — TDI-susceptible (ICH M12)', color: 'bg-emerald-50 text-emerald-800', enzymes: UGT_TDI_ENZYMES },
  { label: 'Other',                            color: 'bg-slate-50 text-slate-600',    enzymes: ['other'] },
];

function TDITab({ data, onChange }: TDITabProps) {
  function update(enzyme: string, patch: Partial<TDIData>) {
    onChange(data.map(t => String(t.enzyme) === enzyme ? { ...t, ...patch } : t));
  }

  return (
    <div>
      <SectionHeader
        title="Time-Dependent (Mechanism-Based) Inhibition — R2 Ratio (ICH M12)"
        subtitle="Enter kinact, KI, and Iu_max. kdeg is pre-filled from human physiology DB. Covers CYPs and UGT1A1/UGT2B7 per ICH M12."
      />

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">Enzyme</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">kinact (h⁻¹)</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">KI (µM)</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">Iu_max (µM)</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">kdeg (h⁻¹)</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600 w-20">λ (h⁻¹)</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600 w-24">Rem. act. (%)</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600 w-16">R2</th>
              <th className="text-center px-3 py-2 font-semibold text-slate-600 w-28">Risk (≥1.25)</th>
            </tr>
          </thead>
          <tbody>
            {TDI_GROUPS.map(group => {
              const groupData = data.filter(t => group.enzymes.includes(t.enzyme as DrugMetabolizingEnzyme));
              return (
                <React.Fragment key={group.label}>
                  <tr>
                    <td colSpan={9} className={clsx('px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider', group.color)}>
                      {group.label}
                    </td>
                  </tr>
                  {groupData.map((t, i) => {
                    const lambda = t.kinact > 0 && t.Iu_max > 0 && t.KI >= 0
                      ? (t.kinact * t.Iu_max) / (t.KI + t.Iu_max)
                      : 0;
                    const kdeg = t.kdeg > 0 ? t.kdeg : 0.0001;
                    const remaining = kdeg / (kdeg + lambda);
                    const R2 = 1 / remaining;
                    const hasData = t.kinact > 0 || t.Iu_max > 0;
                    const risk: DDIRiskLevel = !hasData ? 'no_risk'
                      : R2 >= 1.25 * 2 ? 'high_risk'
                      : R2 >= 1.25     ? 'risk'
                      : 'no_risk';
                    const enz = String(t.enzyme);
                    return (
                      <tr key={enz} className={clsx('border-b border-slate-100 last:border-0', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
                        <td className="px-3 py-1.5 font-mono font-semibold text-slate-700 text-xs">{enz}</td>
                        <td className="px-3 py-1.5">
                          <CellInput value={t.kinact === 0 ? undefined : t.kinact} onChange={v => update(enz, { kinact: v ?? 0 })} placeholder="—" min={0} />
                        </td>
                        <td className="px-3 py-1.5">
                          <CellInput value={t.KI} onChange={v => update(enz, { KI: v ?? 1 })} placeholder="—" min={0} />
                        </td>
                        <td className="px-3 py-1.5">
                          <CellInput value={t.Iu_max === 0 ? undefined : t.Iu_max} onChange={v => update(enz, { Iu_max: v ?? 0 })} placeholder="—" min={0} />
                        </td>
                        <td className="px-3 py-1.5">
                          <CellInput value={t.kdeg} onChange={v => update(enz, { kdeg: v ?? (HUMAN_KDEG[enz] ?? 0.02) })} min={0} step="0.0001" />
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs text-slate-700">
                          {hasData ? lambda.toExponential(3) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-xs text-slate-700">
                          {hasData ? (remaining * 100).toFixed(1) + '%' : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-semibold text-xs">
                          {hasData ? <span className={R2 >= 1.25 ? 'text-orange-700' : 'text-slate-600'}>{R2.toFixed(3)}</span> : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          {hasData ? <RiskBadge risk={risk} /> : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        λ = kinact × Iu / (KI + Iu); R2 = (kdeg + λ) / kdeg; Rem. activity = kdeg / (kdeg + λ).
        Risk threshold R2 ≥ 1.25 (FDA/EMA). kdeg: CYPs from Yang et al. 2008; UGTs from Shen et al. 2016 (~0.0226 h⁻¹).
        ICH M12 (2024) Section 3.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab D — Induction
// ---------------------------------------------------------------------------

// Induction enzyme groups
const IND_GROUPS: { label: string; color: string; enzymes: DrugMetabolizingEnzyme[] }[] = [
  {
    label: 'CYP Enzymes (AhR/PXR/CAR — primary induction pathway)',
    color: 'bg-blue-50 text-blue-800',
    enzymes: CYP_INDUCTION_ENZYMES,
  },
  {
    label: 'UGT Enzymes (AhR/PXR — ICH M12)',
    color: 'bg-emerald-50 text-emerald-800',
    enzymes: UGT_INDUCTION_ENZYMES,
  },
];

interface InductionTabProps {
  data: InductionData[];
  onChange: (v: InductionData[]) => void;
}

function InductionTab({ data, onChange }: InductionTabProps) {
  function update(enzyme: string, patch: Partial<InductionData>) {
    onChange(data.map(d => String(d.enzyme) === enzyme ? { ...d, ...patch } : d));
  }

  function renderRow(d: InductionData, rowIdx: number) {
    const Iu = d.Iu_max ?? 0;
    const EC50 = d.EC50 > 0 ? d.EC50 : 1;
    const fold = 1 + (d.Emax * Iu) / (EC50 + Iu);
    const R3   = 1 + (d.Emax * Iu) / ((EC50 + Iu) * (d.d ?? 1));
    const hasData = d.Emax > 0 || Iu > 0;
    const risk: DDIRiskLevel = !hasData ? 'no_risk'
      : fold >= 2 * 2.5 || (fold >= 2 && R3 >= 2) ? 'high_risk'
      : fold >= 2 || R3 > 1.0 ? 'risk'
      : R3 > 0.9 ? 'potential_risk'
      : 'no_risk';
    const enz = String(d.enzyme);
    return (
      <tr key={enz} className={clsx('border-b border-slate-100 last:border-0', rowIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
        <td className="px-3 py-1.5 font-mono font-semibold text-slate-700 text-xs">{enz}</td>
        <td className="px-3 py-1.5">
          <CellInput value={d.Emax === 0 ? undefined : d.Emax} onChange={v => update(enz, { Emax: v ?? 0 })} placeholder="—" min={0} />
        </td>
        <td className="px-3 py-1.5">
          <CellInput value={d.EC50} onChange={v => update(enz, { EC50: v ?? 1 })} placeholder="—" min={0} />
        </td>
        <td className="px-3 py-1.5">
          <CellInput value={Iu === 0 ? undefined : Iu} onChange={v => update(enz, { Iu_max: v ?? 0 })} placeholder="—" min={0} />
        </td>
        <td className={clsx('px-3 py-1.5 text-right font-mono text-xs', hasData && fold >= 2 ? 'font-bold text-orange-700' : 'text-slate-600')}>
          {hasData ? fold.toFixed(2) : <span className="text-slate-300">—</span>}
        </td>
        <td className="px-3 py-1.5 text-right font-mono text-xs text-slate-700">
          {hasData ? R3.toFixed(3) : <span className="text-slate-300">—</span>}
        </td>
        <td className="px-3 py-1.5 text-center">
          {hasData ? <RiskBadge risk={risk} /> : <span className="text-slate-300 text-xs">—</span>}
        </td>
      </tr>
    );
  }

  return (
    <div>
      <SectionHeader
        title="CYP / UGT Induction — Emax Model (ICH M12)"
        subtitle="Enter Emax (fold), EC50 (µM), and Iu_max (µM). Covers CYPs (AhR/PXR) and UGTs susceptible to nuclear-receptor-mediated induction per ICH M12."
      />

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">Enzyme</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">Emax (fold)</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">EC50 (µM)</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">Iu_max (µM)</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600 w-24">Fold induction</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600 w-16">R3</th>
              <th className="text-center px-3 py-2 font-semibold text-slate-600 w-28">Risk (fold ≥ 2)</th>
            </tr>
          </thead>
          <tbody>
            {IND_GROUPS.map(group => {
              const groupData = data.filter(d => group.enzymes.includes(d.enzyme as DrugMetabolizingEnzyme));
              return (
                <React.Fragment key={group.label}>
                  <tr>
                    <td colSpan={7} className={clsx('px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider', group.color)}>
                      {group.label}
                    </td>
                  </tr>
                  {groupData.map((d, i) => renderRow(d, i))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Fold = 1 + (Emax × Iu) / (EC50 + Iu); R3 = 1 + (Emax × Iu) / ((EC50 + Iu) × d).
        Risk if fold ≥ 2× (FDA) or R3 &gt; 1.0 (EMA).
        UGTs included per ICH M12 (2024): UGT1A1 (AhR/PXR), UGT1A4/UGT2B7 (PXR).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab E — Transporters
// ---------------------------------------------------------------------------

interface TransporterTabProps {
  data: TransporterInhibitionData[];
  onChange: (v: TransporterInhibitionData[]) => void;
}

// Transporter display config (threshold, metric label, R formula)
const TRANSPORTER_THRESHOLDS_DISPLAY: Record<Transporter, { threshold: number; metric: string; label: string }> = {
  // Efflux
  'P-gp':    { threshold: 10,   metric: 'R = 1 + Igut/IC50',  label: 'Gut' },
  'BCRP':    { threshold: 10,   metric: 'R = 1 + Igut/IC50',  label: 'Gut' },
  'MRP2':    { threshold: 0.1,  metric: 'R = Cmax_ub/IC50',   label: 'Sys.' },
  // Hepatic uptake
  'OATP1B1': { threshold: 0.1,  metric: 'R = Iu_inlet/IC50',  label: 'Inlet' },
  'OATP1B3': { threshold: 0.1,  metric: 'R = Iu_inlet/IC50',  label: 'Inlet' },
  'OCT1':    { threshold: 0.1,  metric: 'R = Iu_inlet/IC50',  label: 'Inlet' },
  'NTCP':    { threshold: 0.1,  metric: 'R = Cmax_ub/IC50',   label: 'Sys.' },
  // Renal
  'OAT1':    { threshold: 0.1,  metric: 'R = Cmax_ub/IC50',   label: 'Sys.' },
  'OAT2':    { threshold: 0.1,  metric: 'R = Cmax_ub/IC50',   label: 'Sys.' },
  'OAT3':    { threshold: 0.1,  metric: 'R = Cmax_ub/IC50',   label: 'Sys.' },
  'OCT2':    { threshold: 0.02, metric: 'R = Cmax_ub/IC50',   label: 'Sys.' },
  'MATE1':   { threshold: 0.02, metric: 'R = Cmax_ub/IC50',   label: 'Sys.' },
  'MATE2K':  { threshold: 0.02, metric: 'R = Cmax_ub/IC50',   label: 'Sys.' },
  // Biliary / safety
  'BSEP':    { threshold: 0.01, metric: 'R = Cmax_ub/IC50',   label: 'Sys.' },
};

// Transporter display groups (ICH M12 functional classification)
const TRANSPORTER_GROUPS: { label: string; color: string; transporters: Transporter[] }[] = [
  { label: 'Efflux Transporters',                color: 'bg-blue-50 text-blue-800',      transporters: TRANSPORTERS_EFFLUX },
  { label: 'Hepatic Uptake Transporters',         color: 'bg-amber-50 text-amber-800',    transporters: TRANSPORTERS_HEPATIC },
  { label: 'Renal Secretion Transporters',        color: 'bg-purple-50 text-purple-800',  transporters: TRANSPORTERS_RENAL },
  { label: 'Biliary / Safety (DILI flag)',        color: 'bg-red-50 text-red-800',        transporters: TRANSPORTERS_BILIARY },
];

function computeTransporterR(t: Transporter, entry: TransporterInhibitionData): number | undefined {
  const ic50 = entry.IC50 ?? entry.Ki;
  if (!ic50 || ic50 <= 0) return undefined;

  if (INTESTINAL_TRANSPORTERS.includes(t)) {
    const I = entry.Iu_gut ?? entry.Iu_systemic ?? 0;
    return 1 + I / ic50;
  } else if (HEPATIC_INLET_TRANSPORTERS.includes(t)) {
    const I = entry.Iu_systemic ?? 0;
    return I / ic50;
  } else {
    const I = entry.Iu_systemic ?? 0;
    return I / ic50;
  }
}

function TransporterTab({ data, onChange }: TransporterTabProps) {
  function update(transporter: Transporter, patch: Partial<TransporterInhibitionData>) {
    onChange(data.map(d => d.transporter === transporter ? { ...d, ...patch } : d));
  }

  return (
    <div>
      <SectionHeader
        title="Transporter Inhibition (ICH M12)"
        subtitle="Enter IC50 (µM) and unbound concentrations. ICH M12 covers efflux, hepatic uptake, renal, and biliary transporters."
      />

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-24">Transporter</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">IC50 (µM)</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">Iu_systemic (µM)</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-28">Iu_gut (µM)</th>
              <th className="text-right px-3 py-2 font-semibold text-slate-600 w-16">R</th>
              <th className="text-left px-3 py-2 font-semibold text-slate-600 w-32">Metric</th>
              <th className="text-center px-3 py-2 font-semibold text-slate-600 w-16">Threshold</th>
              <th className="text-center px-3 py-2 font-semibold text-slate-600 w-28">Risk</th>
            </tr>
          </thead>
          <tbody>
            {TRANSPORTER_GROUPS.map(group => {
              const groupData = data.filter(d => group.transporters.includes(d.transporter));
              return (
                <React.Fragment key={group.label}>
                  <tr>
                    <td colSpan={8} className={clsx('px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider', group.color)}>
                      {group.label}
                    </td>
                  </tr>
                  {groupData.map((entry, i) => {
                    const t = entry.transporter;
                    const cfg = TRANSPORTER_THRESHOLDS_DISPLAY[t];
                    const R = computeTransporterR(t, entry);
                    const hasData = (entry.IC50 !== undefined || entry.Ki !== undefined);
                    const isIntestinal = INTESTINAL_TRANSPORTERS.includes(t);

                    let risk: DDIRiskLevel = 'no_risk';
                    if (R !== undefined && cfg) {
                      if (R >= cfg.threshold * 5)       risk = 'high_risk';
                      else if (R >= cfg.threshold)      risk = 'risk';
                      else if (R >= cfg.threshold * 0.5) risk = 'potential_risk';
                    }

                    return (
                      <tr key={t} className={clsx('border-b border-slate-100 last:border-0', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
                        <td className="px-3 py-1.5 font-mono font-semibold text-slate-700 text-xs">{t}</td>
                        <td className="px-3 py-1.5">
                          <CellInput value={entry.IC50} onChange={v => update(t, { IC50: v })} placeholder="—" min={0} />
                        </td>
                        <td className="px-3 py-1.5">
                          <CellInput value={entry.Iu_systemic} onChange={v => update(t, { Iu_systemic: v })} placeholder="—" min={0} />
                        </td>
                        <td className="px-3 py-1.5">
                          <CellInput
                            value={entry.Iu_gut}
                            onChange={v => update(t, { Iu_gut: v })}
                            placeholder={isIntestinal ? '—' : 'N/A'}
                            min={0}
                            className={!isIntestinal ? 'bg-slate-50 cursor-not-allowed text-slate-400' : ''}
                          />
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono font-semibold text-xs">
                          {R !== undefined ? (
                            <span className={R >= (cfg?.threshold ?? 0.1) ? 'text-orange-700' : 'text-slate-700'}>{R.toFixed(4)}</span>
                          ) : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-3 py-1.5 text-slate-500 font-mono text-xs">{cfg?.metric ?? '—'}</td>
                        <td className="px-3 py-1.5 text-center font-mono text-xs text-slate-600">{cfg?.threshold ?? '—'}</td>
                        <td className="px-3 py-1.5 text-center">
                          {hasData && R !== undefined ? <RiskBadge risk={risk} /> : <span className="text-slate-300 text-xs">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-2 text-xs text-slate-400">
        Efflux (P-gp/BCRP): R = 1 + Igut/IC50 ≥ 10; MRP2: Cmax_u/IC50 ≥ 0.1.
        Hepatic (OATP/OCT1): Iu_inlet/IC50 ≥ 0.1; NTCP: Cmax_u/IC50 ≥ 0.1.
        Renal OAT1/2/3: ≥ 0.1; OCT2/MATE1/2K: ≥ 0.02. BSEP (DILI): ≥ 0.01.
        ICH M12 (2024) Section 3.4; FDA (2020); EMA (2012).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab F — Mechanistic Static Models
// ---------------------------------------------------------------------------

const MSM_DEFAULT_ENZYMES: DrugMetabolizingEnzyme[] = ['CYP3A4', 'CYP2D6', 'CYP1A2', 'CYP2C9'];

function defaultMsmEnzymeInputs(): MechanisticStaticEnzymeInputs[] {
  return MSM_DEFAULT_ENZYMES.map(enzyme => ({
    enzyme,
    fm: 0,
    useReversible: false,
    useTDI: false,
    useInduction: false,
    kdeg: HUMAN_KDEG[enzyme] ?? 0.02,
  }));
}

const RISK_COLORS_MSM: Record<DDIRiskLevel, string> = {
  no_risk:       '#22c55e',
  potential_risk:'#eab308',
  risk:          '#f97316',
  high_risk:     '#ef4444',
};

interface MechanisticStaticTabProps {
  msmEnzymeInputs: MechanisticStaticEnzymeInputs[];
  setMsmEnzymeInputs: React.Dispatch<React.SetStateAction<MechanisticStaticEnzymeInputs[]>>;
  msmResults: MechanisticStaticResults | null;
  setMsmResults: React.Dispatch<React.SetStateAction<MechanisticStaticResults | null>>;
  ddiInputs: DDIInputs;
  onImportFile: (file: File) => void;
}

function MechanisticStaticTab({
  msmEnzymeInputs,
  setMsmEnzymeInputs,
  msmResults,
  setMsmResults,
  ddiInputs,
  onImportFile,
}: MechanisticStaticTabProps) {
  const importRef = useRef<HTMLInputElement>(null);

  function updateEnzyme(idx: number, patch: Partial<MechanisticStaticEnzymeInputs>) {
    setMsmEnzymeInputs(prev => prev.map((e, i) => i === idx ? { ...e, ...patch } : e));
  }

  function handleRun() {
    const validEnzymes = msmEnzymeInputs.filter(
      e => e.useReversible || e.useTDI || e.useInduction,
    );
    if (validEnzymes.length === 0) {
      setMsmResults({
        enzymeResults: [],
        overallRisk: 'no_risk',
        warnings: [{
          code: 'MSM_NO_MECHANISMS',
          message: 'No mechanisms enabled. Select at least one mechanism checkbox per enzyme.',
          severity: 'caution',
        }],
      });
      return;
    }
    const inputs = {
      compound: ddiInputs.compound,
      template: 'FDA_2020' as const,
      enzymes: msmEnzymeInputs.filter(e => e.fm > 0 || e.useReversible || e.useTDI || e.useInduction),
    };
    const results = computeMechanisticStatic(inputs);
    setMsmResults(results);
  }

  function handleDownloadTemplate() {
    const csv = ddiCSVTemplate();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ddi-batch-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    onImportFile(file);
    if (importRef.current) importRef.current.value = '';
  }

  function handleExportCurrent() {
    // Export current DDI inputs as CSV with the batch format
    const rows: string[] = [
      'compound_name,enzyme_or_transporter,pathway_type,fm,Ki_uM,IC50_uM,kinact_per_h,KI_uM,Emax_fold,EC50_uM,concentration_metric_type,concentration_value_uM,unbound_fraction,substrate_flag,perpetrator_flag,comments',
    ];
    const name = ddiInputs.compound.name || 'Compound';
    for (const sp of ddiInputs.substratePathways.filter(p => p.fm > 0)) {
      rows.push(`${name},${sp.enzyme},substrate,${sp.fm},,,,,,,,,,true,false,`);
    }
    for (const r of ddiInputs.reversibleInhibitors.filter(r => r.Ki !== undefined || r.IC50 !== undefined)) {
      const Ki = r.Ki ?? '';
      const IC50 = r.IC50 ?? '';
      const Iu = r.Iu_max ?? '';
      rows.push(`${name},${r.enzyme},reversible_inhibitor,,${Ki},${IC50},,,,Iu_max,${Iu},1.0,,true,`);
    }
    for (const t of ddiInputs.tdiData.filter(t => t.kinact > 0)) {
      rows.push(`${name},${t.enzyme},TDI,,,,${t.kinact},${t.KI},,,Iu_max,${t.Iu_max},1.0,,true,`);
    }
    for (const ind of ddiInputs.induction.filter(i => i.Emax > 0)) {
      rows.push(`${name},${ind.enzyme},inducer,,,,,,,${ind.Emax},${ind.EC50},Iu_max,${ind.Iu_max},1.0,,true,`);
    }
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ddi-export-${name}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Pre-populate MSM fields from existing DDI tab data
  function handlePrefillFromDDI() {
    setMsmEnzymeInputs(prev => prev.map(enz => {
      let next = { ...enz };
      // From reversible inhibitors
      const rev = ddiInputs.reversibleInhibitors.find(r => r.enzyme === enz.enzyme);
      if (rev && (rev.Ki !== undefined || rev.IC50 !== undefined)) {
        next = {
          ...next,
          useReversible: true,
          Ki_rev: rev.Ki ?? (rev.IC50 !== undefined ? rev.IC50 / 2 : undefined),
          Iu_rev: rev.Iu_max,
        };
      }
      // From TDI
      const tdi = ddiInputs.tdiData.find(t => t.enzyme === enz.enzyme);
      if (tdi && tdi.kinact > 0) {
        next = {
          ...next,
          useTDI: true,
          kinact: tdi.kinact,
          KI_tdi: tdi.KI,
          Iu_tdi: tdi.Iu_max,
          kdeg: tdi.kdeg,
        };
      }
      // From induction
      const ind = ddiInputs.induction.find(i => i.enzyme === enz.enzyme);
      if (ind && ind.Emax > 0) {
        next = {
          ...next,
          useInduction: true,
          Emax: ind.Emax,
          EC50_ind: ind.EC50,
          Iu_ind: ind.Iu_max,
        };
      }
      // From substrate pathways — fm
      const sub = ddiInputs.substratePathways.find(s => s.enzyme === enz.enzyme);
      if (sub && sub.fm > 0) {
        next = { ...next, fm: sub.fm };
      }
      return next;
    }));
  }

  // Build chart data
  const chartData = msmResults ? msmResults.enzymeResults.map(r => ({
    enzyme: r.enzyme,
    net: r.intermediates.net_activity_ratio,
    AUCR: r.intermediates.AUCR ?? 1,
    risk: r.risk,
  })) : [];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Mechanistic Static Models (FDA 2020 / EMA 2012)"
        subtitle="Combined mechanistic static model: reversible inhibition + TDI + induction → net enzyme activity → AUCR for victim substrate."
      />

      {/* Action buttons row */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handlePrefillFromDDI}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
        >
          <BookOpen size={13} />
          Pre-fill from DDI tabs
        </button>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
        >
          <Download size={13} />
          Download Template
        </button>
        <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer">
          <Upload size={13} />
          Import CSV/XLSX
          <input
            ref={importRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleImportChange}
          />
        </label>
        <button
          onClick={handleExportCurrent}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
        >
          <Download size={13} />
          Export Current
        </button>
        <button
          onClick={handleRun}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 transition-colors"
        >
          <Play size={13} />
          Run Mechanistic Static
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">

        {/* Left panel — Per-enzyme configuration table */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
            Enzyme Configuration
          </h4>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-2 py-2 font-semibold text-slate-600 w-20">Enzyme</th>
                  <th className="text-left px-2 py-2 font-semibold text-slate-600 w-16">fm</th>
                  <th className="text-center px-2 py-2 font-semibold text-slate-600">Rev. Inh.</th>
                  <th className="text-center px-2 py-2 font-semibold text-slate-600">TDI</th>
                  <th className="text-center px-2 py-2 font-semibold text-slate-600">Induction</th>
                </tr>
              </thead>
              <tbody>
                {msmEnzymeInputs.map((enz, idx) => (
                  <React.Fragment key={enz.enzyme}>
                    {/* Main row */}
                    <tr className={clsx('border-b border-slate-100', idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
                      <td className="px-2 py-2 font-mono font-semibold text-slate-700">{enz.enzyme}</td>
                      <td className="px-2 py-2">
                        <CellInput
                          value={enz.fm === 0 ? undefined : enz.fm}
                          onChange={v => updateEnzyme(idx, { fm: v ?? 0 })}
                          placeholder="0"
                          min={0}
                          max={1}
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={enz.useReversible}
                          onChange={e => updateEnzyme(idx, { useReversible: e.target.checked })}
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={enz.useTDI}
                          onChange={e => updateEnzyme(idx, { useTDI: e.target.checked })}
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                      </td>
                      <td className="px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={enz.useInduction}
                          onChange={e => updateEnzyme(idx, { useInduction: e.target.checked })}
                          className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                        />
                      </td>
                    </tr>
                    {/* Parameter expansion rows */}
                    {(enz.useReversible || enz.useTDI || enz.useInduction) && (
                      <tr className={clsx('border-b border-slate-100', idx % 2 === 0 ? 'bg-amber-50/30' : 'bg-amber-50/50')}>
                        <td colSpan={5} className="px-3 py-2">
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                            {enz.useReversible && (
                              <>
                                <div className="flex flex-col gap-1">
                                  <label className="text-slate-500 font-medium">Ki (µM)</label>
                                  <CellInput
                                    value={enz.Ki_rev}
                                    onChange={v => updateEnzyme(idx, { Ki_rev: v })}
                                    placeholder="—"
                                    min={0}
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-slate-500 font-medium">Iu_rev (µM)</label>
                                  <CellInput
                                    value={enz.Iu_rev}
                                    onChange={v => updateEnzyme(idx, { Iu_rev: v })}
                                    placeholder="0"
                                    min={0}
                                  />
                                </div>
                              </>
                            )}
                            {enz.useTDI && (
                              <>
                                <div className="flex flex-col gap-1">
                                  <label className="text-slate-500 font-medium">kinact (h⁻¹)</label>
                                  <CellInput
                                    value={enz.kinact}
                                    onChange={v => updateEnzyme(idx, { kinact: v })}
                                    placeholder="—"
                                    min={0}
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-slate-500 font-medium">KI (µM)</label>
                                  <CellInput
                                    value={enz.KI_tdi}
                                    onChange={v => updateEnzyme(idx, { KI_tdi: v })}
                                    placeholder="—"
                                    min={0}
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-slate-500 font-medium">Iu_tdi (µM)</label>
                                  <CellInput
                                    value={enz.Iu_tdi}
                                    onChange={v => updateEnzyme(idx, { Iu_tdi: v })}
                                    placeholder="0"
                                    min={0}
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-slate-500 font-medium">kdeg (h⁻¹)</label>
                                  <CellInput
                                    value={enz.kdeg}
                                    onChange={v => updateEnzyme(idx, { kdeg: v ?? (HUMAN_KDEG[enz.enzyme] ?? 0.02) })}
                                    min={0}
                                    step="0.0001"
                                  />
                                </div>
                              </>
                            )}
                            {enz.useInduction && (
                              <>
                                <div className="flex flex-col gap-1">
                                  <label className="text-slate-500 font-medium">Emax (fold)</label>
                                  <CellInput
                                    value={enz.Emax}
                                    onChange={v => updateEnzyme(idx, { Emax: v })}
                                    placeholder="—"
                                    min={0}
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-slate-500 font-medium">EC50 (µM)</label>
                                  <CellInput
                                    value={enz.EC50_ind}
                                    onChange={v => updateEnzyme(idx, { EC50_ind: v })}
                                    placeholder="—"
                                    min={0}
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-slate-500 font-medium">Iu_ind (µM)</label>
                                  <CellInput
                                    value={enz.Iu_ind}
                                    onChange={v => updateEnzyme(idx, { Iu_ind: v })}
                                    placeholder="0"
                                    min={0}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">
            Check mechanism boxes to reveal parameter fields. fm = fraction metabolized by this enzyme.
            kdeg auto-filled from human physiology DB. Iu = unbound inhibitor/inducer concentration (µM).
          </p>
        </div>

        {/* Right panel — Results table + visualization */}
        <div className="space-y-4">
          {msmResults ? (
            <>
              {/* Results table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Results</h4>
                  <span className={clsx(
                    'px-2 py-0.5 rounded-full text-xs font-bold',
                    RISK_BG[msmResults.overallRisk],
                  )}>
                    Overall: {RISK_LABEL[msmResults.overallRisk]}
                  </span>
                </div>
                {msmResults.warnings.length > 0 && (
                  <WarningBox warnings={msmResults.warnings} title="Notices" />
                )}
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-2 py-2 font-semibold text-slate-600">Enzyme</th>
                        <th className="text-right px-2 py-2 font-semibold text-slate-600">fm</th>
                        <th className="text-right px-2 py-2 font-semibold text-slate-600">R_rev</th>
                        <th className="text-right px-2 py-2 font-semibold text-slate-600">Act_rev</th>
                        <th className="text-right px-2 py-2 font-semibold text-slate-600">λ</th>
                        <th className="text-right px-2 py-2 font-semibold text-slate-600">R_TDI</th>
                        <th className="text-right px-2 py-2 font-semibold text-slate-600">Act_TDI</th>
                        <th className="text-right px-2 py-2 font-semibold text-slate-600">Fold_Ind</th>
                        <th className="text-right px-2 py-2 font-semibold text-slate-600">Net Act.</th>
                        <th className="text-right px-2 py-2 font-semibold text-slate-600">AUCR</th>
                        <th className="text-center px-2 py-2 font-semibold text-slate-600">Risk</th>
                      </tr>
                    </thead>
                    <tbody>
                      {msmResults.enzymeResults.map((r, i) => {
                        const im = r.intermediates;
                        const enzInput = msmEnzymeInputs.find(e => e.enzyme === r.enzyme);
                        return (
                          <tr key={r.enzyme} className={clsx('border-b border-slate-100 last:border-0', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')}>
                            <td className="px-2 py-2 font-mono font-semibold text-slate-700">{r.enzyme}</td>
                            <td className="px-2 py-2 text-right font-mono text-slate-600">
                              <NumCell v={enzInput?.fm} dp={2} />
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-slate-600">
                              <NumCell v={im.R_rev} />
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-slate-600">
                              <NumCell v={im.activity_rev} />
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-slate-600">
                              <NumCell v={im.lambda} />
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-slate-600">
                              <NumCell v={im.R_TDI} />
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-slate-600">
                              <NumCell v={im.activity_TDI} />
                            </td>
                            <td className="px-2 py-2 text-right font-mono text-slate-600">
                              <NumCell v={im.fold_induction} dp={2} />
                            </td>
                            <td className={clsx('px-2 py-2 text-right font-mono font-semibold',
                              im.net_activity_ratio < 1 ? 'text-orange-700' : im.net_activity_ratio > 1 ? 'text-green-700' : 'text-slate-600')}>
                              <NumCell v={im.net_activity_ratio} />
                            </td>
                            <td className="px-2 py-2 text-right font-mono font-bold text-slate-800">
                              <NumCell v={im.AUCR} dp={2} />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <RiskBadge risk={r.risk} />
                            </td>
                          </tr>
                        );
                      })}
                      {msmResults.enzymeResults.length === 0 && (
                        <tr>
                          <td colSpan={11} className="px-3 py-4 text-center text-slate-400 text-xs">
                            No results. Ensure at least one mechanism is enabled with valid parameters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  Net Act. = Fold_Ind / (R_rev × R_TDI).
                  AUCR = 1 / (fm × Net Act. + (1 − fm)).
                  AUCR &gt; 1: inhibition; AUCR &lt; 1: induction.
                </p>
              </div>

              {/* Visualization */}
              {chartData.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <Plot
                    data={[
                      {
                        type: 'bar',
                        x: chartData.map(d => d.enzyme),
                        y: chartData.map(d => d.net),
                        name: 'Net Activity Ratio',
                        marker: {
                          color: chartData.map(d =>
                            d.net < 1 ? RISK_COLORS_MSM.risk : RISK_COLORS_MSM.no_risk,
                          ),
                        },
                        text: chartData.map(d => d.net.toFixed(3)),
                        textposition: 'outside' as const,
                      },
                      {
                        type: 'scatter',
                        mode: 'lines',
                        x: chartData.map(d => d.enzyme),
                        y: Array(chartData.length).fill(1.0),
                        name: 'Baseline (1.0)',
                        line: { color: '#64748b', dash: 'dash', width: 1.5 },
                      },
                    ]}
                    layout={{
                      title: { text: 'Net CYP Enzyme Activity Ratio', font: { size: 13, color: '#1e293b' } },
                      xaxis: { tickfont: { size: 11 }, gridcolor: '#f1f5f9' },
                      yaxis: {
                        title: { text: 'Net activity (fold_ind / R_rev × R_TDI)', font: { size: 11 } },
                        gridcolor: '#f1f5f9',
                        zeroline: true,
                        zerolinecolor: '#cbd5e1',
                      },
                      plot_bgcolor: '#ffffff',
                      paper_bgcolor: '#ffffff',
                      margin: { t: 45, b: 55, l: 60, r: 20 },
                      height: 280,
                      showlegend: true,
                      legend: { x: 1, xanchor: 'right', y: 1, font: { size: 10 } },
                      font: { family: 'Inter, system-ui, sans-serif', size: 11 },
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              {/* AUCR chart */}
              {chartData.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <Plot
                    data={[
                      {
                        type: 'bar',
                        x: chartData.map(d => d.enzyme),
                        y: chartData.map(d => d.AUCR),
                        name: 'AUCR',
                        marker: {
                          color: chartData.map(d => RISK_COLORS_MSM[d.risk]),
                        },
                        text: chartData.map(d => d.AUCR.toFixed(2)),
                        textposition: 'outside' as const,
                      },
                      {
                        type: 'scatter',
                        mode: 'lines',
                        x: chartData.map(d => d.enzyme),
                        y: Array(chartData.length).fill(1.25),
                        name: 'Potential risk (1.25)',
                        line: { color: '#eab308', dash: 'dash', width: 1.5 },
                      },
                      {
                        type: 'scatter',
                        mode: 'lines',
                        x: chartData.map(d => d.enzyme),
                        y: Array(chartData.length).fill(2.0),
                        name: 'Risk (2.0)',
                        line: { color: '#f97316', dash: 'dot', width: 1.5 },
                      },
                    ]}
                    layout={{
                      title: { text: 'Substrate AUCR', font: { size: 13, color: '#1e293b' } },
                      xaxis: { tickfont: { size: 11 }, gridcolor: '#f1f5f9' },
                      yaxis: {
                        title: { text: 'AUCR (victim AUC ratio)', font: { size: 11 } },
                        gridcolor: '#f1f5f9',
                        zeroline: false,
                      },
                      plot_bgcolor: '#ffffff',
                      paper_bgcolor: '#ffffff',
                      margin: { t: 45, b: 55, l: 60, r: 20 },
                      height: 280,
                      showlegend: true,
                      legend: { x: 1, xanchor: 'right', y: 1, font: { size: 10 } },
                      font: { family: 'Inter, system-ui, sans-serif', size: 11 },
                    }}
                    config={{ displayModeBar: false, responsive: true }}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 py-12 text-center text-sm text-slate-400">
              <Activity size={28} className="mx-auto mb-3 text-amber-300" />
              <p>Click <strong>Run Mechanistic Static</strong> to compute results.</p>
              <p className="text-xs mt-1">Enable mechanisms using checkboxes on the left, then enter parameters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk Matrix
// ---------------------------------------------------------------------------

interface RiskMatrixProps {
  results: DDIResults;
}

function RiskMatrix({ results }: RiskMatrixProps) {
  const pathways = useMemo(() => {
    const all = new Set<string>();
    results.riskMatrix.forEach(e => all.add(e.pathway));
    return Array.from(all);
  }, [results]);

  const types: Array<'substrate' | 'reversible' | 'TDI' | 'induction' | 'transporter'> =
    ['substrate', 'reversible', 'TDI', 'induction', 'transporter'];

  function getEntry(pathway: string, type: typeof types[number]) {
    return results.riskMatrix.find(e => e.pathway === pathway && e.type === type);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-800">Risk Matrix</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Overall risk:</span>
          <span
            className={clsx(
              'px-3 py-1 rounded-full text-sm font-bold',
              RISK_BG[results.overallRisk],
            )}
          >
            {RISK_LABEL[results.overallRisk]}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-3 py-2.5 font-semibold text-slate-600">Pathway</th>
              {types.map(t => (
                <th key={t} className="text-center px-3 py-2.5 font-semibold text-slate-600 capitalize">{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pathways.map((pathway, i) => (
              <tr key={pathway} className={clsx('border-b border-slate-100 last:border-0', i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30')}>
                <td className="px-3 py-2 font-mono font-semibold text-slate-700">{pathway}</td>
                {types.map(type => {
                  const entry = getEntry(pathway, type);
                  return (
                    <td key={type} className={clsx('px-2 py-2 text-center', entry ? RISK_CELL[entry.risk] : '')}>
                      {entry ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <RiskBadge risk={entry.risk} label={RISK_LABEL[entry.risk]} />
                          {entry.metric !== undefined && (
                            <span className="font-mono text-slate-500" style={{ fontSize: '10px' }}>
                              {fmt(entry.metric, 3)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-200">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        {(Object.entries(RISK_BG) as [DDIRiskLevel, string][]).map(([k, cls]) => (
          <span key={k} className={clsx('px-2 py-0.5 rounded-full font-medium', cls)}>
            {RISK_LABEL[k]}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plots section
// ---------------------------------------------------------------------------

interface DDIPlotsProps {
  results: DDIResults;
}

function DDIPlots({ results }: DDIPlotsProps) {
  const AMBER = '#d97706';
  const AMBER_LIGHT = '#fbbf24';
  const SLATE = '#64748b';

  // Plot 1: R1 values
  const r1Data = useMemo(() => {
    return results.reversibleInhibitionResults.filter(r => isFinite(r.metric_value) && !isNaN(r.metric_value));
  }, [results]);

  // Plot 2: R2 values
  const r2Data = useMemo(() => {
    return results.TDIResults.filter(r => isFinite(r.metric_value) && !isNaN(r.metric_value));
  }, [results]);

  // Plot 3: Fold induction
  const inductionData = useMemo(() => {
    return results.inductionResults.filter(r => isFinite(r.metric_value) && !isNaN(r.metric_value));
  }, [results]);

  // Plot 4: Transporter R values
  const transporterData = useMemo(() => {
    return results.transporterResults.filter(r => isFinite(r.metric_value) && !isNaN(r.metric_value));
  }, [results]);

  const plotLayout = (title: string, yTitle: string) => ({
    title: { text: title, font: { size: 13, color: '#1e293b' } },
    xaxis: { tickfont: { size: 11 }, gridcolor: '#f1f5f9' },
    yaxis: { title: { text: yTitle, font: { size: 11 } }, gridcolor: '#f1f5f9', zeroline: true, zerolinecolor: '#cbd5e1' },
    plot_bgcolor: '#ffffff',
    paper_bgcolor: '#ffffff',
    margin: { t: 40, b: 60, l: 60, r: 20 },
    height: 280,
    showlegend: true,
    legend: { x: 1, xanchor: 'right', y: 1, font: { size: 10 } },
    font: { family: 'Inter, system-ui, sans-serif', size: 11 },
  });

  const RISK_COLORS: Record<DDIRiskLevel, string> = {
    no_risk:       '#22c55e',
    potential_risk:'#eab308',
    risk:          '#f97316',
    high_risk:     '#ef4444',
  };

  function barColors(items: { risk: DDIRiskLevel }[]) {
    return items.map(r => RISK_COLORS[r.risk]);
  }

  const plotConfig = { displayModeBar: false, responsive: true };

  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-800 mb-4">Assessment Plots</h3>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* R1 chart */}
        {r1Data.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <Plot
              data={[
                {
                  type: 'bar',
                  x: r1Data.map(r => r.pathway),
                  y: r1Data.map(r => r.metric_value),
                  name: 'R1',
                  marker: { color: barColors(r1Data) },
                  text: r1Data.map(r => r.metric_value.toFixed(3)),
                  textposition: 'outside',
                },
                {
                  type: 'scatter',
                  mode: 'lines',
                  x: r1Data.map(r => r.pathway),
                  y: Array(r1Data.length).fill(1.02),
                  name: 'EMA (1.02)',
                  line: { color: '#3b82f6', dash: 'dash', width: 1.5 },
                },
                {
                  type: 'scatter',
                  mode: 'lines',
                  x: r1Data.map(r => r.pathway),
                  y: Array(r1Data.length).fill(1.1),
                  name: 'FDA (1.1)',
                  line: { color: '#8b5cf6', dash: 'dot', width: 1.5 },
                },
              ]}
              layout={plotLayout('Reversible Inhibition — R1', 'R1 ratio')}
              config={plotConfig}
              style={{ width: '100%' }}
            />
          </div>
        )}

        {/* R2 chart */}
        {r2Data.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <Plot
              data={[
                {
                  type: 'bar',
                  x: r2Data.map(r => r.pathway),
                  y: r2Data.map(r => r.metric_value),
                  name: 'R2',
                  marker: { color: barColors(r2Data) },
                  text: r2Data.map(r => r.metric_value.toFixed(3)),
                  textposition: 'outside',
                },
                {
                  type: 'scatter',
                  mode: 'lines',
                  x: r2Data.map(r => r.pathway),
                  y: Array(r2Data.length).fill(1.25),
                  name: 'Threshold (1.25)',
                  line: { color: '#f97316', dash: 'dash', width: 1.5 },
                },
              ]}
              layout={plotLayout('Time-Dependent Inhibition — R2', 'R2 ratio')}
              config={plotConfig}
              style={{ width: '100%' }}
            />
          </div>
        )}

        {/* Fold induction chart */}
        {inductionData.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <Plot
              data={[
                {
                  type: 'bar',
                  x: inductionData.map(r => r.pathway),
                  y: inductionData.map(r => r.metric_value),
                  name: 'Fold induction',
                  marker: { color: barColors(inductionData) },
                  text: inductionData.map(r => r.metric_value.toFixed(2) + '×'),
                  textposition: 'outside',
                },
                {
                  type: 'scatter',
                  mode: 'lines',
                  x: inductionData.map(r => r.pathway),
                  y: Array(inductionData.length).fill(2),
                  name: 'Threshold (2×)',
                  line: { color: '#f97316', dash: 'dash', width: 1.5 },
                },
              ]}
              layout={plotLayout('CYP Induction — Fold Change', 'Fold induction')}
              config={plotConfig}
              style={{ width: '100%' }}
            />
          </div>
        )}

        {/* Transporter R values */}
        {transporterData.length > 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <Plot
              data={[
                {
                  type: 'bar',
                  x: transporterData.map(r => r.pathway),
                  y: transporterData.map(r => r.metric_value),
                  name: 'R value',
                  marker: { color: barColors(transporterData) },
                  text: transporterData.map(r => r.metric_value.toFixed(3)),
                  textposition: 'outside',
                },
                {
                  type: 'scatter',
                  mode: 'lines',
                  x: transporterData.map(r => r.pathway),
                  y: transporterData.map(r => r.threshold),
                  name: 'Threshold',
                  line: { color: '#f97316', dash: 'dash', width: 1.5 },
                },
              ]}
              layout={plotLayout('Transporter Inhibition — R Values', 'R value')}
              config={plotConfig}
              style={{ width: '100%' }}
            />
          </div>
        )}
      </div>

      {r1Data.length === 0 && r2Data.length === 0 && inductionData.length === 0 && transporterData.length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-400">
          No numerical results to plot. Enter inhibitor/inducer data and run the assessment.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results detail panel
// ---------------------------------------------------------------------------

interface ResultsDetailProps {
  results: DDIResults;
}

function ResultsDetail({ results }: ResultsDetailProps) {
  const [open, setOpen] = useState(false);

  const allWarnings: Warning[] = [
    ...results.warnings,
    ...results.reversibleInhibitionResults.flatMap(r => r.warnings),
    ...results.TDIResults.flatMap(r => r.warnings),
    ...results.inductionResults.flatMap(r => r.warnings),
    ...results.transporterResults.flatMap(r => r.warnings),
  ];

  return (
    <div className="space-y-4">
      {allWarnings.length > 0 && (
        <WarningBox warnings={allWarnings} title="Assessment Notices" collapsible />
      )}

      {/* Substrate detail */}
      {results.substrateResults.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-2.5 bg-slate-50 cursor-pointer select-none"
            onClick={() => setOpen(o => !o)}
          >
            <span className="text-sm font-semibold text-slate-700">Substrate Results Detail</span>
            {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </div>
          {open && (
            <div className="p-3 space-y-2">
              {results.substrateResults.map(sr => (
                <div key={String(sr.enzyme)} className="flex items-start gap-3 text-xs">
                  <span className="font-mono font-semibold text-slate-700 w-16 shrink-0">{String(sr.enzyme)}</span>
                  <RiskBadge risk={sr.riskLevel} />
                  <span className="text-slate-500">{sr.note}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reversible detail */}
      {results.reversibleInhibitionResults.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50">
            <span className="text-sm font-semibold text-slate-700">Reversible Inhibition — Rationale</span>
          </div>
          <div className="divide-y divide-slate-100">
            {results.reversibleInhibitionResults.map(r => (
              <div key={r.pathway} className="flex items-start gap-3 px-4 py-2 text-xs">
                <span className="font-mono font-semibold text-slate-700 w-16 shrink-0">{r.pathway}</span>
                <span className="font-mono w-16 text-slate-500">R1={isNaN(r.metric_value) ? '—' : r.metric_value.toFixed(3)}</span>
                <RiskBadge risk={r.risk} />
                <span className="text-slate-400 flex-1">{r.rationale}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TDI detail */}
      {results.TDIResults.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50">
            <span className="text-sm font-semibold text-slate-700">TDI — Rationale</span>
          </div>
          <div className="divide-y divide-slate-100">
            {results.TDIResults.map(r => (
              <div key={r.pathway} className="flex items-start gap-3 px-4 py-2 text-xs">
                <span className="font-mono font-semibold text-slate-700 w-16 shrink-0">{r.pathway}</span>
                <span className="font-mono w-16 text-slate-500">R2={isNaN(r.metric_value) ? '—' : r.metric_value.toFixed(3)}</span>
                <RiskBadge risk={r.risk} />
                <span className="text-slate-400 flex-1">{r.rationale}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Induction detail */}
      {results.inductionResults.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50">
            <span className="text-sm font-semibold text-slate-700">Induction — Rationale</span>
          </div>
          <div className="divide-y divide-slate-100">
            {results.inductionResults.map(r => (
              <div key={r.pathway} className="flex items-start gap-3 px-4 py-2 text-xs">
                <span className="font-mono font-semibold text-slate-700 w-16 shrink-0">{r.pathway}</span>
                <span className="font-mono w-20 text-slate-500">Fold={isNaN(r.metric_value) ? '—' : r.metric_value.toFixed(2)}</span>
                <RiskBadge risk={r.risk} />
                <span className="text-slate-400 flex-1">{r.rationale}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transporter detail */}
      {results.transporterResults.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50">
            <span className="text-sm font-semibold text-slate-700">Transporter — Rationale</span>
          </div>
          <div className="divide-y divide-slate-100">
            {results.transporterResults.map(r => (
              <div key={r.pathway} className="flex items-start gap-3 px-4 py-2 text-xs">
                <span className="font-mono font-semibold text-slate-700 w-20 shrink-0">{r.pathway}</span>
                <span className="font-mono w-16 text-slate-500">R={isNaN(r.metric_value) ? '—' : r.metric_value.toFixed(4)}</span>
                <RiskBadge risk={r.risk} />
                <span className="text-slate-400 flex-1">{r.rationale}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Concentration inputs panel
// ---------------------------------------------------------------------------

interface ConcPanelProps {
  inputs: DDIInputs;
  onChange: (patch: Partial<DDIInputs>) => void;
  onFillIuFields?: () => void;
}

function ConcPanel({ inputs, onChange, onFillIuFields }: ConcPanelProps) {
  // Derived unbound Cmax when both fup and Cmax_total are provided
  const derivedCmaxUnbound =
    inputs.fup !== undefined && inputs.Cmax_total !== undefined
      ? parseFloat((inputs.fup * inputs.Cmax_total).toFixed(4))
      : undefined;

  // When fup or Cmax_total changes, auto-set Cmax_unbound if derivable
  function handleFupChange(v: number | undefined) {
    const patch: Partial<DDIInputs> = { fup: v };
    if (v !== undefined && inputs.Cmax_total !== undefined) {
      patch.Cmax_unbound = parseFloat((v * inputs.Cmax_total).toFixed(4));
    }
    onChange(patch);
  }

  function handleCmaxTotalChange(v: number | undefined) {
    const patch: Partial<DDIInputs> = { Cmax_total: v };
    if (v !== undefined && inputs.fup !== undefined) {
      patch.Cmax_unbound = parseFloat((inputs.fup * v).toFixed(4));
    }
    onChange(patch);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-700">Compound &amp; Concentration Data</h3>
        {onFillIuFields && inputs.Cmax_unbound !== undefined && (
          <button
            onClick={onFillIuFields}
            className="text-xs px-2 py-1 rounded bg-amber-50 border border-amber-300 text-amber-700 hover:bg-amber-100 transition-colors"
            title="Copy Cmax_unbound into all empty Iu_max fields across inhibitor, TDI, and induction tabs"
          >
            Fill Iu fields from Cmax_unbound
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {/* Compound name */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Compound name</label>
          <input
            type="text"
            className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
            value={inputs.compound.name}
            onChange={e => onChange({ compound: { ...inputs.compound, name: e.target.value } })}
            placeholder="Compound name"
          />
        </div>

        {/* Cmax_total with its own handler */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">Cmax_total (µM)</label>
          <input
            type="number"
            className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
            value={inputs.Cmax_total ?? ''}
            onChange={e => {
              const v = e.target.value === '' ? undefined : parseFloat(e.target.value);
              handleCmaxTotalChange(isNaN(v as number) ? undefined : v);
            }}
            placeholder="—"
            min={0}
            step="any"
          />
        </div>

        {/* fup — key new field */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">
            fu (fup)
            <span className="ml-1 text-slate-400 font-normal">0–1</span>
          </label>
          <input
            type="number"
            className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
            value={inputs.fup ?? ''}
            onChange={e => {
              const v = e.target.value === '' ? undefined : parseFloat(e.target.value);
              handleFupChange(isNaN(v as number) ? undefined : v);
            }}
            placeholder="e.g. 0.08"
            min={0}
            max={1}
            step="0.001"
          />
        </div>

        {/* Cmax_unbound — shows derived value or manual entry */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-600">
            Cmax_unbound (µM)
            {derivedCmaxUnbound !== undefined && (
              <span className="ml-1 text-amber-600 font-normal">(auto)</span>
            )}
          </label>
          <input
            type="number"
            className={clsx(
              'rounded border px-2 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500',
              derivedCmaxUnbound !== undefined
                ? 'border-amber-300 bg-amber-50'
                : 'border-slate-200 bg-white',
            )}
            value={inputs.Cmax_unbound ?? ''}
            onChange={e => {
              const v = e.target.value === '' ? undefined : parseFloat(e.target.value);
              onChange({ Cmax_unbound: isNaN(v as number) ? undefined : v });
            }}
            placeholder={derivedCmaxUnbound !== undefined ? String(derivedCmaxUnbound) : '—'}
            min={0}
            step="any"
          />
        </div>

        {/* Remaining numeric fields */}
        {[
          { label: 'Dose (mg)', key: 'dose_mg' as keyof DDIInputs },
          { label: 'Bioavailability F', key: 'bioavailability_F' as keyof DDIInputs },
          { label: 'Dosing interval (h)', key: 'dosingInterval_h' as keyof DDIInputs },
          { label: 'fabs', key: 'fabs' as keyof DDIInputs },
          { label: 'Qgut (mL/min)', key: 'Qgut_mL_min' as keyof DDIInputs },
        ].map(({ label, key }) => (
          <div key={key} className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">{label}</label>
            <input
              type="number"
              className="rounded border border-slate-200 bg-white px-2 py-1.5 text-xs font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
              value={(inputs[key] as number | undefined) ?? ''}
              onChange={e => {
                const v = e.target.value === '' ? undefined : parseFloat(e.target.value);
                onChange({ [key]: isNaN(v as number) ? undefined : v });
              }}
              placeholder="—"
              min={0}
              step="any"
            />
          </div>
        ))}

        <div className="flex flex-col gap-1 justify-end">
          <label className="text-xs font-medium text-slate-600">Use inlet conc.</label>
          <label className="flex items-center gap-2 h-[30px] cursor-pointer">
            <input
              type="checkbox"
              checked={inputs.useInletConcentration}
              onChange={e => onChange({ useInletConcentration: e.target.checked })}
              className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-xs text-slate-600">Hepatic inlet</span>
          </label>
        </div>
      </div>

      {/* Derivation hint */}
      {derivedCmaxUnbound !== undefined && (
        <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1 border border-amber-200">
          Cmax_unbound auto-derived: {inputs.Cmax_total} µM × {inputs.fup} = <strong>{derivedCmaxUnbound} µM</strong>.
          Edit the field above to override.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main DDIModule component
// ---------------------------------------------------------------------------

export default function DDIModule() {
  const {
    ddiInputs, ddiResults, ddiRunning,
    setDDIInputs, setDDIResults, setDDIRunning,
    saveRun,
  } = useAppStore();

  const [inputs, setInputsState] = useState<DDIInputs>(() => ddiInputs ?? blankInputs());
  const [results, setResultsState] = useState<DDIResults | null>(ddiResults);
  const [activeTab, setActiveTab] = useState<TabId>('substrate');
  const [outerTab, setOuterTab] = useState<'assessment' | 'plots'>('assessment');
  const [error, setError] = useState<string | null>(null);

  // Tab F — Mechanistic Static Model state
  const [msmEnzymeInputs, setMsmEnzymeInputs] = useState<MechanisticStaticEnzymeInputs[]>(
    () => defaultMsmEnzymeInputs(),
  );
  const [msmResults, setMsmResults] = useState<MechanisticStaticResults | null>(null);

  // Ref for the header-level import file input
  const headerImportRef = useRef<HTMLInputElement>(null);

  // Helpers
  function setInputs(patch: Partial<DDIInputs> | ((prev: DDIInputs) => DDIInputs)) {
    setInputsState(prev => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch };
      return next;
    });
  }

  // Build the DDIInputs for the engine: filter out zero/empty rows
  function buildEngineInputs(inp: DDIInputs): DDIInputs {
    return {
      ...inp,
      substratePathways: inp.substratePathways.filter(p => p.fm > 0),
      reversibleInhibitors: inp.reversibleInhibitors.filter(
        r => (r.Ki !== undefined && r.Ki > 0) || (r.IC50 !== undefined && r.IC50 > 0),
      ),
      tdiData: inp.tdiData.filter(t => t.kinact > 0 && t.Iu_max > 0),
      induction: inp.induction.filter(i => i.Emax > 0 || i.Iu_max > 0),
      transporterInhibition: inp.transporterInhibition.filter(
        t => (t.IC50 !== undefined && t.IC50 > 0) || (t.Ki !== undefined && t.Ki > 0),
      ),
    };
  }

  const handleRun = useCallback(() => {
    setError(null);
    setDDIRunning(true);
    try {
      const engineInputs = buildEngineInputs(inputs);
      const r = runDDI(engineInputs);
      setResultsState(r);
      setDDIResults(r);
      setDDIInputs(inputs);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDDIRunning(false);
    }
  }, [inputs, setDDIInputs, setDDIResults, setDDIRunning]);

  const handleLoadExample = useCallback(() => {
    const ei = sampleToInputs(DDI_SAMPLE);
    setInputsState(ei);
    setDDIInputs(ei);
    setResultsState(null);
    setDDIResults(null);
    setError(null);
  }, [setDDIInputs, setDDIResults]);

  const handleReset = useCallback(() => {
    const blank = blankInputs();
    setInputsState(blank);
    setResultsState(null);
    setDDIResults(null);
    setError(null);
  }, [setDDIResults]);

  const handleSave = useCallback(() => {
    if (!results) return;
    const session = {
      metadata: createRunMetadata('ddi'),
      compound: inputs.compound,
      inputs: buildEngineInputs(inputs),
      methodsSelected: ['substrate', 'reversible_inhibition', 'TDI', 'induction', 'transporter'],
      intermediateResults: {},
      finalResults: results,
      warnings: results.warnings,
      assumptions: [
        'Static mechanistic models (FDA/EMA guidance).',
        'R1 = 1 + Iu/Ki (reversible inhibition).',
        'R2 = (kdeg + λ)/kdeg (TDI/MBI).',
        'Fold induction = 1 + Emax×I/(EC50+I).',
        'Transporter R values per FDA 2020 / EMA 2012.',
      ],
      units: {
        Ki: 'µM',
        IC50: 'µM',
        Iu: 'µM',
        kinact: 'h⁻¹',
        kdeg: 'h⁻¹',
        KI: 'µM',
        EC50: 'µM',
      },
    };
    saveRun(session);
    alert('DDI run saved to session history.');
  }, [inputs, results, saveRun]);

  const handleExportJSON = useCallback(() => {
    if (!results) return;
    const session = {
      metadata: createRunMetadata('ddi'),
      compound: inputs.compound,
      inputs: buildEngineInputs(inputs),
      methodsSelected: ['substrate', 'reversible_inhibition', 'TDI', 'induction', 'transporter'],
      intermediateResults: {},
      finalResults: results,
      warnings: results.warnings,
      assumptions: [],
      units: { Ki: 'µM', IC50: 'µM' },
    };
    exportJSON(session, `ddi-${inputs.compound.name || 'compound'}-${Date.now()}.json`);
  }, [inputs, results]);

  const handleDownloadDDITemplate = useCallback(() => {
    const csv = ddiCSVTemplate();
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ddi-batch-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // Propagate Cmax_unbound to all empty Iu_max fields across inhibitor/TDI/induction tabs
  const handleFillIuFields = useCallback(() => {
    const iu = inputs.Cmax_unbound;
    if (iu === undefined) return;
    setInputs(prev => ({
      ...prev,
      reversibleInhibitors: prev.reversibleInhibitors.map(r => ({
        ...r,
        Iu_max: r.Iu_max ?? iu,
        Iu_inlet: r.Iu_inlet ?? iu,
      })),
      tdiData: prev.tdiData.map(t => ({
        ...t,
        Iu_max: t.Iu_max === 0 || t.Iu_max === undefined ? iu : t.Iu_max,
      })),
      induction: prev.induction.map(ind => ({
        ...ind,
        Iu_max: ind.Iu_max === 0 || ind.Iu_max === undefined ? iu : ind.Iu_max,
      })),
      transporterInhibition: prev.transporterInhibition.map(tr => ({
        ...tr,
        Iu_systemic: tr.Iu_systemic ?? iu,
      })),
    }));
  }, [inputs.Cmax_unbound]);

  const handleImportDDIFile = useCallback(async (file: File) => {
    try {
      const rows = await parseFile(file);
      const batchRecords = parseDDIBatchCSV(rows);
      if (batchRecords.length === 0) {
        alert('No valid records found in file.');
        return;
      }
      // Load first compound's data into the DDI tabs
      const firstCompound = batchRecords[0].compound_name;
      const compoundRecords = batchRecords.filter(r => r.compound_name === firstCompound);

      const next = blankInputs();
      next.compound.name = firstCompound;

      for (const rec of compoundRecords) {
        const enzyme = rec.enzyme_or_transporter;
        switch (rec.pathway_type) {
          case 'substrate': {
            const idx = next.substratePathways.findIndex(p => p.enzyme === enzyme);
            if (idx >= 0 && rec.fm !== undefined) {
              next.substratePathways[idx] = { ...next.substratePathways[idx], fm: rec.fm };
            }
            break;
          }
          case 'reversible_inhibitor': {
            const idx = next.reversibleInhibitors.findIndex(r => r.enzyme === enzyme);
            if (idx >= 0) {
              next.reversibleInhibitors[idx] = {
                ...next.reversibleInhibitors[idx],
                Ki: rec.Ki,
                IC50: rec.IC50,
                Iu_max: rec.concentration_value,
              };
            }
            break;
          }
          case 'TDI': {
            const idx = next.tdiData.findIndex(t => t.enzyme === enzyme);
            if (idx >= 0) {
              next.tdiData[idx] = {
                ...next.tdiData[idx],
                kinact: rec.kinact ?? 0,
                KI: rec.KI ?? 1,
                Iu_max: rec.concentration_value ?? 0,
              };
            }
            break;
          }
          case 'inducer': {
            const idx = next.induction.findIndex(i => i.enzyme === enzyme);
            if (idx >= 0) {
              next.induction[idx] = {
                ...next.induction[idx],
                Emax: rec.Emax ?? 0,
                EC50: rec.EC50 ?? 1,
                Iu_max: rec.concentration_value ?? 0,
              };
            }
            break;
          }
        }
      }

      setInputsState(next);
      setDDIInputs(next);
      setResultsState(null);
      setDDIResults(null);
      setError(null);
    } catch (err) {
      alert(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [setDDIInputs, setDDIResults]);

  return (
    <div className="min-h-full bg-slate-50">
      {/* Module header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between max-w-screen-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-amber-600 flex items-center justify-center">
              <Activity size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">DDI Assessment</h1>
              <p className="text-xs text-slate-500">
                Drug-drug interaction risk assessment — substrate, inhibition (reversible + TDI), induction, transporters
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadExample}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              <BookOpen size={14} />
              Load example
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              <RotateCcw size={14} />
              Reset
            </button>
            <button
              onClick={handleDownloadDDITemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
            >
              <Download size={14} />
              DDI Template
            </button>
            <label className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors cursor-pointer">
              <Upload size={14} />
              Import DDI
              <input
                ref={headerImportRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={async e => {
                  const file = e.target.files?.[0];
                  if (file) {
                    await handleImportDDIFile(file);
                    if (headerImportRef.current) headerImportRef.current.value = '';
                  }
                }}
              />
            </label>
            {results && (
              <>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                >
                  <Save size={14} />
                  Save run
                </button>
                <button
                  onClick={handleExportJSON}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 transition-colors"
                >
                  <Download size={14} />
                  Export JSON
                </button>
              </>
            )}
            <button
              onClick={handleRun}
              disabled={ddiRunning}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
                ddiRunning
                  ? 'bg-amber-300 text-white cursor-not-allowed'
                  : 'bg-amber-600 text-white hover:bg-amber-700',
              )}
            >
              <Play size={14} />
              {ddiRunning ? 'Running…' : 'Run DDI'}
            </button>
          </div>
        </div>
      </div>

      {/* Outer tab bar */}
      <Tabs.Root
        value={outerTab}
        onValueChange={v => setOuterTab(v as 'assessment' | 'plots')}
        className="max-w-screen-2xl mx-auto"
      >
        <div className="bg-white border-b border-slate-200 px-4">
          <Tabs.List className="flex gap-0" aria-label="DDI sections">
            <Tabs.Trigger
              value="assessment"
              className="px-5 py-3 text-sm font-medium text-slate-500 border-b-2 border-transparent hover:text-slate-800 hover:border-slate-300 transition-colors data-[state=active]:text-amber-700 data-[state=active]:border-amber-600 focus:outline-none"
            >
              DDI Assessment
            </Tabs.Trigger>
            <Tabs.Trigger
              value="plots"
              className="px-5 py-3 text-sm font-medium text-slate-500 border-b-2 border-transparent hover:text-slate-800 hover:border-slate-300 transition-colors data-[state=active]:text-amber-700 data-[state=active]:border-amber-600 focus:outline-none"
            >
              Plots &amp; Risk
            </Tabs.Trigger>
          </Tabs.List>
        </div>

        {/* Outer Tab 1: DDI Assessment */}
        <Tabs.Content value="assessment" className="focus:outline-none">
          <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">

            {/* Compound + Concentration panel */}
            <ConcPanel
              inputs={inputs}
              onChange={patch => setInputs(prev => ({ ...prev, ...patch }))}
              onFillIuFields={handleFillIuFields}
            />

            {/* Error banner */}
            {error && (
              <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                <span><strong>Error:</strong> {error}</span>
              </div>
            )}

            {/* Inner A-F tab navigation + content */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
              {/* Inner tab bar */}
              <div className="flex border-b border-slate-200 overflow-x-auto">
                {TABS.map((tab, idx) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={clsx(
                      'flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                      activeTab === tab.id
                        ? 'border-amber-600 text-amber-700 bg-amber-50'
                        : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300',
                    )}
                  >
                    <span className="hidden sm:inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 mr-0.5">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="hidden md:block">{tab.label}</span>
                    <span className="md:hidden">{tab.shortLabel}</span>
                  </button>
                ))}
              </div>

              {/* Inner tab content */}
              <div className="p-5">
                {activeTab === 'substrate' && (
                  <SubstrateTab
                    pathways={inputs.substratePathways}
                    mmKinetics={inputs.mmKinetics}
                    onChange={v => setInputs({ substratePathways: v })}
                    onMMChange={v => setInputs({ mmKinetics: v })}
                  />
                )}
                {activeTab === 'reversible' && (
                  <ReversibleTab
                    inhibitors={inputs.reversibleInhibitors}
                    onChange={v => setInputs({ reversibleInhibitors: v })}
                  />
                )}
                {activeTab === 'tdi' && (
                  <TDITab
                    data={inputs.tdiData}
                    onChange={v => setInputs({ tdiData: v })}
                  />
                )}
                {activeTab === 'induction' && (
                  <InductionTab
                    data={inputs.induction}
                    onChange={v => setInputs({ induction: v })}
                  />
                )}
                {activeTab === 'transporters' && (
                  <TransporterTab
                    data={inputs.transporterInhibition}
                    onChange={v => setInputs({ transporterInhibition: v })}
                  />
                )}
                {activeTab === 'mechanistic' && (
                  <MechanisticStaticTab
                    msmEnzymeInputs={msmEnzymeInputs}
                    setMsmEnzymeInputs={setMsmEnzymeInputs}
                    msmResults={msmResults}
                    setMsmResults={setMsmResults}
                    ddiInputs={inputs}
                    onImportFile={handleImportDDIFile}
                  />
                )}
              </div>
            </div>

            {/* Risk matrix results — shown when run has been performed */}
            {results && (
              <>
                {/* Risk matrix */}
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <RiskMatrix results={results} />
                </div>

                {/* Detail / rationale panel */}
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <h3 className="text-sm font-semibold text-slate-800 mb-4">Detailed Results &amp; Rationale</h3>
                  <ResultsDetail results={results} />
                </div>
              </>
            )}

            {/* Pre-run placeholder */}
            {!results && (
              <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
                <Activity size={32} className="mx-auto text-amber-300 mb-3" />
                <p className="text-slate-500 text-sm mb-1">No results yet</p>
                <p className="text-slate-400 text-xs">
                  Enter compound data in the tabs above and click <strong>Run DDI</strong>.
                  <br />
                  Use <strong>Load example</strong> to populate with Compound B demo data.
                </p>
              </div>
            )}
          </div>
        </Tabs.Content>

        {/* Outer Tab 2: Plots & Risk */}
        <Tabs.Content value="plots" className="focus:outline-none">
          <div className="max-w-screen-2xl mx-auto px-6 py-6">
            {results ? (
              <div className="space-y-6">
                {/* DDI assessment plots */}
                <div className="rounded-xl border border-slate-200 bg-white p-5">
                  <DDIPlots results={results} />
                </div>

                {/* Mechanistic static charts (Tab F) */}
                {msmResults && msmResults.enzymeResults.length > 0 && (() => {
                  const chartData = msmResults.enzymeResults.map(r => ({
                    enzyme: r.enzyme,
                    net: r.intermediates.net_activity_ratio,
                    AUCR: r.intermediates.AUCR ?? 1,
                    risk: r.risk,
                  }));
                  const RISK_COLORS_PLOT: Record<DDIRiskLevel, string> = {
                    no_risk:       '#22c55e',
                    potential_risk:'#eab308',
                    risk:          '#f97316',
                    high_risk:     '#ef4444',
                  };
                  return (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                      <h3 className="text-sm font-semibold text-slate-800">Mechanistic Static Model Charts</h3>
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <Plot
                          data={[
                            {
                              type: 'bar',
                              x: chartData.map(d => d.enzyme),
                              y: chartData.map(d => d.net),
                              name: 'Net Activity Ratio',
                              marker: {
                                color: chartData.map(d =>
                                  d.net < 1 ? RISK_COLORS_PLOT.risk : RISK_COLORS_PLOT.no_risk,
                                ),
                              },
                              text: chartData.map(d => d.net.toFixed(3)),
                              textposition: 'outside' as const,
                            },
                            {
                              type: 'scatter',
                              mode: 'lines',
                              x: chartData.map(d => d.enzyme),
                              y: Array(chartData.length).fill(1.0),
                              name: 'Baseline (1.0)',
                              line: { color: '#64748b', dash: 'dash', width: 1.5 },
                            },
                          ]}
                          layout={{
                            title: { text: 'Net CYP Enzyme Activity Ratio', font: { size: 13, color: '#1e293b' } },
                            xaxis: { tickfont: { size: 11 }, gridcolor: '#f1f5f9' },
                            yaxis: {
                              title: { text: 'Net activity (fold_ind / R_rev × R_TDI)', font: { size: 11 } },
                              gridcolor: '#f1f5f9',
                              zeroline: true,
                              zerolinecolor: '#cbd5e1',
                            },
                            plot_bgcolor: '#ffffff',
                            paper_bgcolor: '#ffffff',
                            margin: { t: 45, b: 55, l: 60, r: 20 },
                            height: 280,
                            showlegend: true,
                            legend: { x: 1, xanchor: 'right', y: 1, font: { size: 10 } },
                            font: { family: 'Inter, system-ui, sans-serif', size: 11 },
                          }}
                          config={{ displayModeBar: false, responsive: true }}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-white p-3">
                        <Plot
                          data={[
                            {
                              type: 'bar',
                              x: chartData.map(d => d.enzyme),
                              y: chartData.map(d => d.AUCR),
                              name: 'AUCR',
                              marker: {
                                color: chartData.map(d => RISK_COLORS_PLOT[d.risk]),
                              },
                              text: chartData.map(d => d.AUCR.toFixed(2)),
                              textposition: 'outside' as const,
                            },
                            {
                              type: 'scatter',
                              mode: 'lines',
                              x: chartData.map(d => d.enzyme),
                              y: Array(chartData.length).fill(1.25),
                              name: 'Potential risk (1.25)',
                              line: { color: '#eab308', dash: 'dash', width: 1.5 },
                            },
                            {
                              type: 'scatter',
                              mode: 'lines',
                              x: chartData.map(d => d.enzyme),
                              y: Array(chartData.length).fill(2.0),
                              name: 'Risk (2.0)',
                              line: { color: '#f97316', dash: 'dot', width: 1.5 },
                            },
                          ]}
                          layout={{
                            title: { text: 'Substrate AUCR', font: { size: 13, color: '#1e293b' } },
                            xaxis: { tickfont: { size: 11 }, gridcolor: '#f1f5f9' },
                            yaxis: {
                              title: { text: 'AUCR (victim AUC ratio)', font: { size: 11 } },
                              gridcolor: '#f1f5f9',
                              zeroline: false,
                            },
                            plot_bgcolor: '#ffffff',
                            paper_bgcolor: '#ffffff',
                            margin: { t: 45, b: 55, l: 60, r: 20 },
                            height: 280,
                            showlegend: true,
                            legend: { x: 1, xanchor: 'right', y: 1, font: { size: 10 } },
                            font: { family: 'Inter, system-ui, sans-serif', size: 11 },
                          }}
                          config={{ displayModeBar: false, responsive: true }}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white py-16 text-center">
                <Activity size={32} className="mx-auto text-amber-300 mb-3" />
                <p className="text-slate-500 text-sm mb-1">No plots available yet</p>
                <p className="text-slate-400 text-xs">
                  Switch to <strong>DDI Assessment</strong>, enter data, and click <strong>Run DDI</strong>.
                </p>
              </div>
            )}
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
