import React from 'react';
import { Info } from 'lucide-react';
import type { AllometryMethod } from '@/types';

interface MethodOption {
  id: AllometryMethod;
  label: string;
  description: string;
  requiresFup?: boolean;
  requiresBrainWeight?: boolean;
  requiresMLP?: boolean;
  group: string;
}

const METHOD_OPTIONS: MethodOption[] = [
  {
    id: 'simple',
    label: 'Simple Allometry',
    description: 'CL = a × BW^b. Fits log-log OLS regression across all species.',
    group: 'Core',
  },
  {
    id: 'unbound_fraction',
    label: 'Unbound Fraction Correction',
    description: 'Scales CLu = CL/fup across species, then recovers CL_human = CLu_human × fup_human.',
    requiresFup: true,
    group: 'Core',
  },
  {
    id: 'brain_weight',
    label: 'Brain Weight Correction',
    description: 'Boxenbaum (1982): corrects for brain weight as a proxy for metabolic rate.',
    requiresBrainWeight: true,
    group: 'Core',
  },
  {
    id: 'MLP',
    label: 'MLP Correction',
    description: 'Boxenbaum (1982): Maximum Life Potential correction. CL_corr_i = CL_i × MLP_i.',
    requiresMLP: true,
    group: 'Core',
  },
  {
    id: 'rule_of_exponent',
    label: 'Rule of Exponent',
    description: 'Examines allometric exponent b and auto-selects or recommends correction methods.',
    group: 'Core',
  },
  {
    id: 'caldwell_tang_1',
    label: 'Caldwell–Tang 1 (MLP + fup)',
    description: 'Caldwell (2004): CLcorr = (CL × MLP) / fup. Combined MLP and unbound fraction correction.',
    requiresFup: true,
    requiresMLP: true,
    group: 'Caldwell & Tang',
  },
  {
    id: 'caldwell_tang_2',
    label: 'Caldwell–Tang 2 (BrW + fup)',
    description: 'Tang (2007): Brain-weight and fup combined. CLcorr = (CL × BW × fup_human) / (BrW × fup_i).',
    requiresFup: true,
    requiresBrainWeight: true,
    group: 'Caldwell & Tang',
  },
  {
    id: 'caldwell_tang_3',
    label: 'Caldwell–Tang 3 (MPPGL proxy)',
    description: 'Metabolic activity normalization via microsomal protein content proxy.',
    group: 'Caldwell & Tang',
  },
  {
    id: 'liver_blood_flow',
    label: 'Liver Blood Flow Normalization',
    description: 'Normalizes CL by hepatic blood flow per species (CL/Qh), fits vs BW, recovers human CL × Qh_human.',
    group: 'Extended',
  },
  {
    id: 'species_invariant_time',
    label: 'Species-Invariant Time (Dedrick)',
    description: 'Dedrick (1972) chronological → physiological time transformation. Useful for t1/2 allometry.',
    group: 'Extended',
  },
  {
    id: 'fixed_exponent_0_75',
    label: 'Fixed Exponent b = 0.75',
    description: 'Exploratory: scales by metabolic body weight exponent 0.75.',
    group: 'Fixed Exponent',
  },
  {
    id: 'fixed_exponent_0_85',
    label: 'Fixed Exponent b = 0.85',
    description: 'Exploratory: scales by exponent 0.85 (intermediate allometric correction).',
    group: 'Fixed Exponent',
  },
  {
    id: 'fixed_exponent_1_0',
    label: 'Fixed Exponent b = 1.0 (linear)',
    description: 'Linear scaling by body weight.',
    group: 'Fixed Exponent',
  },
  {
    id: 'two_species',
    label: 'Two-Species Sensitivity',
    description: 'Fits all species pairs, reports CL prediction range across pairs.',
    group: 'Sensitivity',
  },
  {
    id: 'three_species',
    label: 'Three-Species Sensitivity',
    description: 'Fits all species triplets, reports CL prediction range.',
    group: 'Sensitivity',
  },
  {
    id: 'monkey_only',
    label: 'Monkey-Only Exploratory',
    description: 'Uses monkey-to-human direct scaling. Single-species exploratory.',
    group: 'Sensitivity',
  },
  {
    id: 'leave_one_out',
    label: 'Leave-One-Species-Out CV',
    description: 'Cross-validation: predict each species by leaving it out of regression.',
    group: 'Diagnostics',
  },
];

const GROUPS = ['Core', 'Caldwell & Tang', 'Extended', 'Fixed Exponent', 'Sensitivity', 'Diagnostics'];

interface Props {
  selected: AllometryMethod[];
  onChange: (methods: AllometryMethod[]) => void;
  availableFup: boolean;
  availableBrainWeight: boolean;
  availableMLP: boolean;
}

export default function MethodSelector({ selected, onChange, availableFup, availableBrainWeight, availableMLP }: Props) {
  function toggle(id: AllometryMethod) {
    if (selected.includes(id)) {
      onChange(selected.filter(m => m !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  function isDisabled(opt: MethodOption): boolean {
    if (opt.requiresFup && !availableFup) return true;
    if (opt.requiresBrainWeight && !availableBrainWeight) return true;
    if (opt.requiresMLP && !availableMLP) return true;
    return false;
  }

  return (
    <div className="space-y-3">
      {GROUPS.map(group => {
        const groupMethods = METHOD_OPTIONS.filter(m => m.group === group);
        return (
          <div key={group}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">{group}</p>
            <div className="space-y-1">
              {groupMethods.map(opt => {
                const disabled = isDisabled(opt);
                const checked = selected.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className={`flex items-start gap-2 cursor-pointer rounded-md px-2 py-1.5 border transition-colors ${
                      checked
                        ? 'bg-indigo-50 border-indigo-300'
                        : disabled
                        ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                        : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => !disabled && toggle(opt.id)}
                      disabled={disabled}
                      className="mt-0.5 accent-indigo-600 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-slate-800">{opt.label}</span>
                        {opt.requiresFup && (
                          <span className="text-[10px] text-indigo-500 bg-indigo-50 px-1 rounded">fup</span>
                        )}
                        {opt.requiresBrainWeight && (
                          <span className="text-[10px] text-teal-500 bg-teal-50 px-1 rounded">BrW</span>
                        )}
                        {opt.requiresMLP && (
                          <span className="text-[10px] text-amber-600 bg-amber-50 px-1 rounded">MLP</span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{opt.description}</p>
                      {disabled && (
                        <p className="text-[10px] text-orange-500 mt-0.5">
                          <Info size={10} className="inline mr-0.5" />
                          Missing required input above.
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
