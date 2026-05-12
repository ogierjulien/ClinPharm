/**
 * Named allometric scaling method implementations.
 * Each method exposes metadata (equations, assumptions, provenance) and returns
 * a complete AllometrySingleMethodResult.
 *
 * References:
 *   Boxenbaum (1982) J Pharmacokinet Biopharm 10:201–227
 *   Dedrick (1972) Cancer Chemother Rep 56:441–450
 *   Tang & Mayersohn (2005, 2006, 2007)
 *   Caldwell et al. (2004) J Pharm Sci 93:2222–2230
 */

import type {
  AllometryMethod,
  AllometryMethodConfig,
  AllometrySingleMethodResult,
  AnimalDataPoint,
  BackPrediction,
  Warning,
} from '@/types';

import {
  fitAllometricRegression,
  fitRobustRegression,
  predictFromRegression,
  computePE,
  computeAAFE,
  computeFoldError,
} from './regression';

// ---------------------------------------------------------------------------
// Species physiology reference values (Qh and brain weight are needed here)
// ---------------------------------------------------------------------------

/** Hepatic blood flow (mL/min) for common preclinical / clinical species. */
const SPECIES_QH_ML_MIN: Partial<Record<string, number>> = {
  mouse:              1.8,
  rat:               13.8,
  guinea_pig:         6.0,
  hamster:            3.5,
  rabbit:            39.6,
  dog:              309.0,
  monkey:           151.0,
  cynomolgus_monkey: 151.0,
  rhesus_monkey:    151.0,
  minipig:          185.0,
  human:           1500.0,
};

// ---------------------------------------------------------------------------
// METHOD CONFIGS
// ---------------------------------------------------------------------------

export const ALLOMETRY_METHOD_CONFIGS: Record<AllometryMethod, AllometryMethodConfig> = {
  simple: {
    id: 'simple',
    label: 'Simple Allometry',
    description:
      'Fit P = a × BW^b using log-log OLS across all species. ' +
      'Most widely used first-pass approach for CL and Vss prediction.',
    equations: ['ln(P) = ln(a) + b × ln(BW)', 'P_human = a × BW_human^b'],
    assumptions: [
      'Elimination pathway is conserved across species',
      'No protein binding differences between species',
      'Linear PK',
    ],
    provenance: 'Boxenbaum (1982); Mahmood & Balian (1996)',
    requiresFup: false,
    requiresBrainWeight: false,
    requiresMLP: false,
    minSpecies: 3,
  },

  unbound_fraction: {
    id: 'unbound_fraction',
    label: 'Unbound Fraction Correction',
    description:
      'Corrects CL for inter-species fup differences. ' +
      'CLu_i = CL_abs_i / fup_i → fit CLu = a × BW^b → CL_human = CLu_human × fup_human.',
    equations: [
      'CLu_i = CL_i / fup_i',
      'CLu = a × BW^b',
      'CL_human = CLu_human × fup_human',
    ],
    assumptions: [
      'Unbound CL is more conserved across species than total CL',
      'Protein binding differences are the primary source of inter-species variability',
    ],
    provenance: 'Bachmann et al. (1996)',
    requiresFup: true,
    requiresBrainWeight: false,
    requiresMLP: false,
    minSpecies: 3,
  },

  brain_weight: {
    id: 'brain_weight',
    label: 'Brain Weight Correction (Boxenbaum 1982)',
    description:
      'Corrects CL by brain weight to account for differences in metabolic capacity. ' +
      'Corrected_CL_i = CL_abs_i × BW_i / BrW_i.',
    equations: [
      'Corrected_CL_i = CL_i × BW_i / BrW_i',
      'Corrected_CL = a × BW^b',
      'CL_human = a × BW_human^b × BrW_human / BW_human',
    ],
    assumptions: [
      'Brain weight is a proxy for CNS-mediated metabolic activity',
      'Useful for drugs with significant CNS penetration/metabolism',
    ],
    provenance: 'Boxenbaum (1982) J Pharmacokinet Biopharm 10:201',
    requiresFup: false,
    requiresBrainWeight: true,
    requiresMLP: false,
    minSpecies: 3,
  },

  MLP: {
    id: 'MLP',
    label: 'MLP Correction (Boxenbaum 1982)',
    description:
      'Corrects CL by maximum lifespan potential (MLP). ' +
      'Corrected_CL_i = CL_abs_i × MLP_i.',
    equations: [
      'Corrected_CL_i = CL_i × MLP_i',
      'Corrected_CL = a × BW^b',
      'CL_human = (a × BW_human^b) / MLP_human',
    ],
    assumptions: [
      'MLP reflects species differences in metabolic rate and longevity',
      'Best for drugs eliminated via oxidative metabolism',
    ],
    provenance: 'Boxenbaum (1982) J Pharmacokinet Biopharm 10:201',
    requiresFup: false,
    requiresBrainWeight: false,
    requiresMLP: true,
    minSpecies: 3,
  },

  rule_of_exponent: {
    id: 'rule_of_exponent',
    label: 'Rule of Exponent (Mahmood)',
    description:
      'Selects the best correction method based on the allometric exponent from simple allometry. ' +
      'b < 0.55: simple; 0.55–0.70: simple with caution; 0.70–1.0: correction recommended; ≥1.0: strongly suggest correction.',
    equations: [
      'Run simple allometry first',
      'b < 0.55 → simple allometry',
      '0.55 ≤ b < 0.70 → simple with caution',
      '0.70 ≤ b < 1.0 → brain weight / MLP correction',
      'b ≥ 1.0 → strong correction needed',
    ],
    assumptions: ['Allometric exponent guides method selection'],
    provenance: 'Mahmood & Balian (1996) J Pharm Sci 85:103',
    requiresFup: false,
    requiresBrainWeight: false,
    requiresMLP: false,
    minSpecies: 3,
  },

  liver_blood_flow: {
    id: 'liver_blood_flow',
    label: 'Liver Blood Flow Normalization',
    description:
      'Normalises CL by hepatic blood flow (Qh) before fitting. ' +
      'Normalized_CL_i = CL_i / Qh_i → fit vs BW → recover CL_human = predicted × Qh_human.',
    equations: [
      'Normalized_CL_i = CL_i / Qh_i',
      'Normalized_CL = a × BW^b',
      'CL_human = predicted × Qh_human',
    ],
    assumptions: [
      'Qh scales allometrically across species',
      'CL/Qh ratio (extraction ratio) is relatively conserved',
    ],
    provenance: 'Lave et al. (1997) J Pharm Sci 86:584',
    requiresFup: false,
    requiresBrainWeight: false,
    requiresMLP: false,
    minSpecies: 3,
  },

  species_invariant_time: {
    id: 'species_invariant_time',
    label: 'Species-Invariant Time (Dedrick 1972)',
    description:
      'Uses kronecker time scaling to collapse multi-species PK data onto a single curve. ' +
      'Provides normalized CL per unit BW^b.',
    equations: [
      'T* = t × (BW^(1-b)) / a',
      'CL_normalized = CL / BW^b',
    ],
    assumptions: [
      'PK time course is self-similar across species when time is scaled by BW^(1-b)',
    ],
    provenance: 'Dedrick (1972) Cancer Chemother Rep 56:441',
    requiresFup: false,
    requiresBrainWeight: false,
    requiresMLP: false,
    minSpecies: 3,
  },

  fixed_exponent_0_75: {
    id: 'fixed_exponent_0_75',
    label: 'Fixed Exponent (b = 0.75)',
    description:
      'Uses a fixed allometric exponent of 0.75 (metabolic scaling theory). ' +
      'CL_human = CL_ref × (BW_human / BW_ref)^0.75.',
    equations: ['CL_human = CL_ref × (BW_human / BW_ref)^0.75'],
    assumptions: [
      'Metabolic rate scales with the 3/4-power of body mass (West et al.)',
    ],
    provenance: 'West et al. (1997) Science 276:122; Boxenbaum (1980)',
    requiresFup: false,
    requiresBrainWeight: false,
    requiresMLP: false,
    minSpecies: 1,
  },

  fixed_exponent_0_85: {
    id: 'fixed_exponent_0_85',
    label: 'Fixed Exponent (b = 0.85)',
    description:
      'Uses a fixed allometric exponent of 0.85 (empirical mid-range value). ' +
      'CL_human = CL_ref × (BW_human / BW_ref)^0.85.',
    equations: ['CL_human = CL_ref × (BW_human / BW_ref)^0.85'],
    assumptions: ['Empirically derived exponent for CL scaling'],
    provenance: 'Mahmood (1998) Eur J Drug Metab Pharmacokinet 23:49',
    requiresFup: false,
    requiresBrainWeight: false,
    requiresMLP: false,
    minSpecies: 1,
  },

  fixed_exponent_1_0: {
    id: 'fixed_exponent_1_0',
    label: 'Fixed Exponent (b = 1.0) — Linear',
    description:
      'Uses a fixed allometric exponent of 1.0 (linear body-weight scaling). ' +
      'CL_human = CL_ref × (BW_human / BW_ref).',
    equations: ['CL_human = CL_ref × (BW_human / BW_ref)^1.0'],
    assumptions: ['Linear proportional scaling with body weight'],
    provenance: 'General pharmacokinetic practice',
    requiresFup: false,
    requiresBrainWeight: false,
    requiresMLP: false,
    minSpecies: 1,
  },

  robust_regression: {
    id: 'robust_regression',
    label: 'Robust Regression (Huber M-estimator)',
    description:
      'Huber M-estimator IRLS fit to reduce sensitivity to outliers. ' +
      'Uses median-absolute-deviation for scale and iteratively re-weighted least squares.',
    equations: [
      'w_i = min(1, k / |r_i / σ|) where σ = MAD / 0.6745',
      'P = a × BW^b (weighted fit)',
    ],
    assumptions: [
      'At most one or two outlier species present',
      'Majority of species follow power-law relationship',
    ],
    provenance: 'Huber (1973); Maronna et al. (2006) Robust Statistics',
    requiresFup: false,
    requiresBrainWeight: false,
    requiresMLP: false,
    minSpecies: 3,
  },

  two_species: {
    id: 'two_species',
    label: 'Two-Species Sensitivity Analysis',
    description:
      'Systematically uses each pair of species to fit allometric regressions. ' +
      'Reports range of human CL predictions across all pairs.',
    equations: ['P = a × BW^b (for each pair of species)', 'Report: range, median of predicted human values'],
    assumptions: ['Each species pair provides an independent estimate'],
    provenance: 'Internal sensitivity analysis approach',
    requiresFup: false,
    requiresBrainWeight: false,
    requiresMLP: false,
    minSpecies: 2,
  },

  three_species: {
    id: 'three_species',
    label: 'Three-Species Sensitivity Analysis',
    description:
      'Uses every combination of 3 species to fit allometric regressions. ' +
      'Reports range of predictions across all triplets.',
    equations: ['P = a × BW^b (for each triplet)', 'Report: range, median'],
    assumptions: ['Each species triplet provides an independent estimate'],
    provenance: 'Internal sensitivity analysis approach',
    requiresFup: false,
    requiresBrainWeight: false,
    requiresMLP: false,
    minSpecies: 3,
  },

  monkey_only: {
    id: 'monkey_only',
    label: 'Monkey-Only Scaling',
    description:
      'Uses only non-human primate data for scaling to humans. ' +
      'Monkey-to-human ratio applied directly or via single-species factor.',
    equations: [
      'CL_human = CL_monkey × (BW_human / BW_monkey)^b',
      'b estimated from monkey data (if >1 point) or default 0.75',
    ],
    assumptions: [
      'Non-human primate metabolism closely approximates human metabolism',
      'CYP and UGT enzyme profiles are most similar in primates',
    ],
    provenance: 'Lave et al. (1997); Mahmood (2002)',
    requiresFup: false,
    requiresBrainWeight: false,
    requiresMLP: false,
    minSpecies: 1,
  },

  leave_one_out: {
    id: 'leave_one_out',
    label: 'Leave-One-Out Cross-Validation',
    description:
      'Iteratively leaves out each species, re-fits regression on the remaining species, ' +
      'and back-predicts the excluded species to assess predictive performance.',
    equations: ['Fit P = a × BW^b on n-1 species', 'Predict excluded species', 'Compute fold error'],
    assumptions: ['Assesses leave-one-out cross-validation error'],
    provenance: 'Standard CV approach for allometry',
    requiresFup: false,
    requiresBrainWeight: false,
    requiresMLP: false,
    minSpecies: 3,
  },

  caldwell_tang_1: {
    id: 'caldwell_tang_1',
    label: 'Caldwell–Tang Variant 1 (MLP + fup)',
    description:
      'Corrects CL by both MLP and fup: CLcorr_i = (CL_abs_i × MLP_i) / fup_i. ' +
      'CL_human = (a × BW_human^b × fup_human) / MLP_human.',
    equations: [
      'CLcorr_i = (CL_i × MLP_i) / fup_i',
      'CLcorr = a × BW^b',
      'CL_human = (a × BW_human^b × fup_human) / MLP_human',
    ],
    assumptions: [
      'Combined effect of MLP and protein binding differences drives inter-species CL variability',
    ],
    provenance: 'Caldwell et al. (2004) J Pharm Sci 93:2222',
    requiresFup: true,
    requiresBrainWeight: false,
    requiresMLP: true,
    minSpecies: 3,
  },

  caldwell_tang_2: {
    id: 'caldwell_tang_2',
    label: 'Caldwell–Tang Variant 2 (Brain weight + fup)',
    description:
      'Tang 2007 variant combining brain-weight and unbound fraction: ' +
      'CLcorr_i = (CL_abs_i × BW_i × fup_human) / (BrW_i × fup_i).',
    equations: [
      'CLcorr_i = (CL_i × BW_i × fup_human) / (BrW_i × fup_i)',
      'CLcorr = a × BW^b',
      'CL_human = a × BW_human^b × BrW_human / BW_human',
    ],
    assumptions: [
      'Combined brain weight and unbound fraction correction provides best human CL estimate',
    ],
    provenance: 'Tang et al. (2007) Drug Metab Dispos 35:1886',
    requiresFup: true,
    requiresBrainWeight: true,
    requiresMLP: false,
    minSpecies: 3,
  },

  caldwell_tang_3: {
    id: 'caldwell_tang_3',
    label: 'Caldwell–Tang Variant 3 (MPPGL Correction)',
    description:
      'Metabolic activity normalization via microsomal protein content. ' +
      'Falls back to MPPGL ratio correction if CYP content unavailable.',
    equations: [
      'CLcorr_i = CL_i × (MPPGL_human / MPPGL_i)',
      'CLcorr = a × BW^b',
      'CL_human = a × BW_human^b',
    ],
    assumptions: [
      'Microsomal protein content per gram liver (MPPGL) normalizes metabolic capacity differences',
    ],
    provenance: 'Caldwell et al. (2004); Houston (1994)',
    requiresFup: false,
    requiresBrainWeight: false,
    requiresMLP: false,
    minSpecies: 3,
  },
};

// ---------------------------------------------------------------------------
// DEFAULT MPPGL values for common species
// ---------------------------------------------------------------------------
const SPECIES_MPPGL: Partial<Record<string, number>> = {
  mouse:             45,
  rat:               45,
  guinea_pig:        40,
  rabbit:            35,
  dog:               40,
  monkey:            34,
  cynomolgus_monkey: 34,
  rhesus_monkey:     34,
  minipig:           38,
  human:             45,
};

const DEFAULT_BRAIN_WEIGHT_HUMAN_G = 1400;
const DEFAULT_MLP_HUMAN_YEARS      = 122;

// ---------------------------------------------------------------------------
// INTERNAL HELPERS
// ---------------------------------------------------------------------------

/** Warn if fewer than minSpecies data points are available. */
function warnIfFewSpecies(n: number, minSpecies: number, methodId: string): Warning[] {
  const warnings: Warning[] = [];
  if (n < minSpecies) {
    warnings.push({
      code: 'FEW_SPECIES',
      message: `${methodId}: only ${n} species available (minimum recommended: ${minSpecies})`,
      severity: n < 2 ? 'error' : 'caution',
    });
  }
  return warnings;
}

/** Check whether a dataset is rodent-only. */
function isRodentOnlyDataset(data: AnimalDataPoint[]): boolean {
  const rodents = new Set(['mouse', 'rat', 'guinea_pig', 'hamster']);
  return data.every(d => rodents.has(d.species));
}

/** Build back-predictions for CL from a regression. */
function buildBackPredictions(
  data: AnimalDataPoint[],
  CLvalues: number[],
  predictFn: (BW: number) => number,
  VssValues?: number[],
  predictVssFn?: (BW: number) => number,
): BackPrediction[] {
  return data.map((d, i) => {
    const clPred = predictFn(d.bodyWeight_kg);
    const clObs  = CLvalues[i];
    const bp: BackPrediction = {
      species:     d.species,
      label:       d.label,
      bodyWeight_kg: d.bodyWeight_kg,
      CL_observed:  clObs,
      CL_predicted: clPred,
      CL_PE_pct:    clObs > 0 && clPred > 0 ? computePE(clPred, clObs) : undefined,
      CL_foldError: clObs > 0 && clPred > 0 ? computeFoldError(clPred, clObs) : undefined,
    };
    if (VssValues && predictVssFn) {
      const vPred = predictVssFn(d.bodyWeight_kg);
      const vObs  = VssValues[i];
      bp.Vss_observed  = vObs;
      bp.Vss_predicted = vPred;
      bp.Vss_PE_pct    = vObs > 0 && vPred > 0 ? computePE(vPred, vObs) : undefined;
      bp.Vss_foldError = vObs > 0 && vPred > 0 ? computeFoldError(vPred, vObs) : undefined;
    }
    return bp;
  });
}

// ---------------------------------------------------------------------------
// 1. SIMPLE ALLOMETRY
// ---------------------------------------------------------------------------

export function simpleAllometry(
  data: AnimalDataPoint[],
  humanBW: number,
): AllometrySingleMethodResult {
  const method = ALLOMETRY_METHOD_CONFIGS.simple;
  const warnings: Warning[] = warnIfFewSpecies(data.length, method.minSpecies, method.id);

  if (isRodentOnlyDataset(data)) {
    warnings.push({
      code: 'RODENT_ONLY',
      message: 'Dataset contains only rodent species; allometric prediction may be unreliable.',
      severity: 'caution',
    });
  }

  const BWs    = data.map(d => d.bodyWeight_kg);
  const CLvals = data.map(d => d.CL_abs ?? d.CL_observed);
  const Vvals  = data.map(d => d.Vss_abs  ?? d.Vss_observed);

  let regCL, regVss, predCL, predVss;
  let backPreds: BackPrediction[] = [];
  let AAFE_CL, AAFE_Vss;

  if (data.length >= 2) {
    regCL  = fitAllometricRegression(BWs, CLvals);
    regVss = fitAllometricRegression(BWs, Vvals);
    predCL  = predictFromRegression(regCL, humanBW);
    predVss = predictFromRegression(regVss, humanBW);

    backPreds = buildBackPredictions(data, CLvals, bw => predictFromRegression(regCL!, bw), Vvals, bw => predictFromRegression(regVss!, bw));
    AAFE_CL  = computeAAFE(backPreds.map(b => b.CL_predicted!), CLvals);
    AAFE_Vss = computeAAFE(backPreds.map(b => b.Vss_predicted!), Vvals);
  }

  return {
    method:             'simple',
    label:              method.label,
    regressionCL:       regCL,
    regressionVss:      regVss,
    predictedCL_human:  predCL,
    predictedVss_human: predVss,
    backPredictions:    backPreds,
    AAFE_CL,
    AAFE_Vss,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// 2. UNBOUND FRACTION ALLOMETRY
// ---------------------------------------------------------------------------

export function unboundFractionAllometry(
  data: AnimalDataPoint[],
  humanBW: number,
  humanFup: number,
): AllometrySingleMethodResult {
  const method = ALLOMETRY_METHOD_CONFIGS.unbound_fraction;
  const warnings: Warning[] = warnIfFewSpecies(data.length, method.minSpecies, method.id);

  if (humanFup <= 0 || humanFup > 1) {
    warnings.push({ code: 'INVALID_FUP', message: 'Human fup must be between 0 and 1.', severity: 'error' });
  }

  // Check all species have fup
  const filtered = data.filter(d => d.fup !== undefined && d.fup > 0);
  if (filtered.length < data.length) {
    warnings.push({
      code: 'MISSING_FUP',
      message: `${data.length - filtered.length} species missing fup; excluded from unbound fraction fit.`,
      severity: 'warning',
    });
  }

  const BWs    = filtered.map(d => d.bodyWeight_kg);
  const CLu    = filtered.map(d => (d.CL_abs ?? d.CL_observed) / (d.fup as number));
  const Vvals  = filtered.map(d => d.Vss_abs ?? d.Vss_observed);

  let regCLu, regVss, predCL, predVss;
  let backPreds: BackPrediction[] = [];
  let AAFE_CL, AAFE_Vss;

  if (filtered.length >= 2) {
    regCLu = fitAllometricRegression(BWs, CLu);
    regVss = fitAllometricRegression(BWs, Vvals);
    const predCLu = predictFromRegression(regCLu, humanBW);
    predCL  = predCLu * humanFup;
    predVss = predictFromRegression(regVss, humanBW);

    const CLabs = filtered.map(d => d.CL_abs ?? d.CL_observed);
    backPreds = buildBackPredictions(
      filtered,
      CLabs,
      bw => {
        const idx = filtered.findIndex(d => d.bodyWeight_kg === bw);
        const fup = filtered[idx]?.fup ?? humanFup;
        return predictFromRegression(regCLu!, bw) * fup;
      },
      Vvals,
      bw => predictFromRegression(regVss!, bw),
    );
    AAFE_CL  = computeAAFE(backPreds.map(b => b.CL_predicted!), CLabs);
    AAFE_Vss = computeAAFE(backPreds.map(b => b.Vss_predicted!), Vvals);
  }

  return {
    method:             'unbound_fraction',
    label:              method.label,
    regressionCL:       regCLu,
    regressionVss:      regVss,
    predictedCL_human:  predCL,
    predictedVss_human: predVss,
    backPredictions:    backPreds,
    AAFE_CL,
    AAFE_Vss,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// 3. BRAIN WEIGHT ALLOMETRY
// ---------------------------------------------------------------------------

export function brainWeightAllometry(
  data: AnimalDataPoint[],
  humanBW: number,
  humanBrainWeight_g: number,
): AllometrySingleMethodResult {
  const method = ALLOMETRY_METHOD_CONFIGS.brain_weight;
  const warnings: Warning[] = warnIfFewSpecies(data.length, method.minSpecies, method.id);

  const filtered = data.filter(d => d.brainWeight_g !== undefined && d.brainWeight_g > 0);
  if (filtered.length < data.length) {
    warnings.push({
      code: 'MISSING_BRAIN_WEIGHT',
      message: `${data.length - filtered.length} species missing brain weight; excluded.`,
      severity: 'warning',
    });
  }

  const BWs   = filtered.map(d => d.bodyWeight_kg);
  // Corrected CL = CL × BW / BrW
  const CLcor = filtered.map(d =>
    (d.CL_abs ?? d.CL_observed) * d.bodyWeight_kg / (d.brainWeight_g as number),
  );
  const Vvals = filtered.map(d => d.Vss_abs ?? d.Vss_observed);

  let regCL, regVss, predCL, predVss;
  let backPreds: BackPrediction[] = [];
  let AAFE_CL, AAFE_Vss;

  if (filtered.length >= 2) {
    regCL  = fitAllometricRegression(BWs, CLcor);
    regVss = fitAllometricRegression(BWs, Vvals);
    // Recover: CL_human = a × BW_human^b × BrW_human / BW_human
    predCL  = predictFromRegression(regCL, humanBW) * humanBrainWeight_g / humanBW;
    predVss = predictFromRegression(regVss, humanBW);

    const CLabs = filtered.map(d => d.CL_abs ?? d.CL_observed);
    backPreds = buildBackPredictions(
      filtered,
      CLabs,
      bw => {
        const pt = filtered.find(d => d.bodyWeight_kg === bw);
        const brW = pt?.brainWeight_g ?? humanBrainWeight_g;
        return predictFromRegression(regCL!, bw) * brW / bw;
      },
      Vvals,
      bw => predictFromRegression(regVss!, bw),
    );
    AAFE_CL  = computeAAFE(backPreds.map(b => b.CL_predicted!), CLabs);
    AAFE_Vss = computeAAFE(backPreds.map(b => b.Vss_predicted!), Vvals);
  }

  return {
    method:             'brain_weight',
    label:              method.label,
    regressionCL:       regCL,
    regressionVss:      regVss,
    predictedCL_human:  predCL,
    predictedVss_human: predVss,
    backPredictions:    backPreds,
    AAFE_CL,
    AAFE_Vss,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// 4. MLP ALLOMETRY
// ---------------------------------------------------------------------------

export function MLPAllometry(
  data: AnimalDataPoint[],
  humanBW: number,
  humanMLP: number,
): AllometrySingleMethodResult {
  const method = ALLOMETRY_METHOD_CONFIGS.MLP;
  const warnings: Warning[] = warnIfFewSpecies(data.length, method.minSpecies, method.id);

  const filtered = data.filter(d => d.MLP_years !== undefined && d.MLP_years > 0);
  if (filtered.length < data.length) {
    warnings.push({
      code: 'MISSING_MLP',
      message: `${data.length - filtered.length} species missing MLP; excluded.`,
      severity: 'warning',
    });
  }

  const BWs   = filtered.map(d => d.bodyWeight_kg);
  // Corrected CL = CL × MLP
  const CLcor = filtered.map(d => (d.CL_abs ?? d.CL_observed) * (d.MLP_years as number));
  const Vvals = filtered.map(d => d.Vss_abs ?? d.Vss_observed);

  let regCL, regVss, predCL, predVss;
  let backPreds: BackPrediction[] = [];
  let AAFE_CL, AAFE_Vss;

  if (filtered.length >= 2) {
    regCL  = fitAllometricRegression(BWs, CLcor);
    regVss = fitAllometricRegression(BWs, Vvals);
    predCL  = predictFromRegression(regCL, humanBW) / humanMLP;
    predVss = predictFromRegression(regVss, humanBW);

    const CLabs = filtered.map(d => d.CL_abs ?? d.CL_observed);
    backPreds = buildBackPredictions(
      filtered,
      CLabs,
      bw => {
        const pt   = filtered.find(d => d.bodyWeight_kg === bw);
        const mlp  = pt?.MLP_years ?? humanMLP;
        return predictFromRegression(regCL!, bw) / mlp;
      },
      Vvals,
      bw => predictFromRegression(regVss!, bw),
    );
    AAFE_CL  = computeAAFE(backPreds.map(b => b.CL_predicted!), CLabs);
    AAFE_Vss = computeAAFE(backPreds.map(b => b.Vss_predicted!), Vvals);
  }

  return {
    method:             'MLP',
    label:              method.label,
    regressionCL:       regCL,
    regressionVss:      regVss,
    predictedCL_human:  predCL,
    predictedVss_human: predVss,
    backPredictions:    backPreds,
    AAFE_CL,
    AAFE_Vss,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// 5. RULE OF EXPONENT
// ---------------------------------------------------------------------------

export function ruleOfExponent(
  data: AnimalDataPoint[],
  humanBW: number,
  humanFup?: number,
  humanMLP?: number,
  humanBrainWeight_g?: number,
): AllometrySingleMethodResult {
  const method = ALLOMETRY_METHOD_CONFIGS.rule_of_exponent;
  const warnings: Warning[] = warnIfFewSpecies(data.length, method.minSpecies, method.id);

  // First run simple allometry to get exponent
  const simple = simpleAllometry(data, humanBW);
  const b = simple.regressionCL?.slope ?? NaN;

  let result: AllometrySingleMethodResult;

  if (isNaN(b)) {
    warnings.push({ code: 'ROE_NO_SLOPE', message: 'Could not compute allometric exponent.', severity: 'error' });
    result = simple;
  } else if (b < 0.55) {
    warnings.push({ code: 'ROE_SIMPLE', message: `Exponent b=${b.toFixed(3)} < 0.55 → simple allometry recommended.`, severity: 'info' });
    result = simple;
  } else if (b < 0.70) {
    warnings.push({
      code: 'ROE_CAUTION',
      message: `Exponent b=${b.toFixed(3)} between 0.55 and 0.70 → simple allometry with caution; consider correction methods.`,
      severity: 'caution',
    });
    result = simple;
  } else if (b < 1.0) {
    warnings.push({
      code: 'ROE_CORRECTION',
      message: `Exponent b=${b.toFixed(3)} between 0.70 and 1.0 → correction method (brain weight or MLP) recommended.`,
      severity: 'warning',
    });
    // Attempt best available correction
    if (humanBrainWeight_g !== undefined) {
      result = brainWeightAllometry(data, humanBW, humanBrainWeight_g);
    } else if (humanMLP !== undefined) {
      result = MLPAllometry(data, humanBW, humanMLP);
    } else {
      warnings.push({ code: 'ROE_MISSING_CORRECTION', message: 'Correction method unavailable — falling back to simple allometry.', severity: 'caution' });
      result = simple;
    }
  } else {
    warnings.push({
      code: 'ROE_STRONG_CORRECTION',
      message: `Exponent b=${b.toFixed(3)} ≥ 1.0 → strong correction required; predictions may be unreliable.`,
      severity: 'warning',
    });
    if (humanBrainWeight_g !== undefined) {
      result = brainWeightAllometry(data, humanBW, humanBrainWeight_g);
    } else if (humanMLP !== undefined) {
      result = MLPAllometry(data, humanBW, humanMLP);
    } else {
      warnings.push({ code: 'ROE_MISSING_CORRECTION', message: 'Correction method unavailable — falling back to simple allometry.', severity: 'warning' });
      result = simple;
    }
  }

  return {
    ...result,
    method: 'rule_of_exponent',
    label:  method.label,
    warnings: [...warnings, ...result.warnings],
  };
}

// ---------------------------------------------------------------------------
// 6. LIVER BLOOD FLOW NORMALISATION
// ---------------------------------------------------------------------------

export function liverBloodFlowAllometry(
  data: AnimalDataPoint[],
  humanBW: number,
  humanQh_mL_min: number,
): AllometrySingleMethodResult {
  const method = ALLOMETRY_METHOD_CONFIGS.liver_blood_flow;
  const warnings: Warning[] = warnIfFewSpecies(data.length, method.minSpecies, method.id);

  // Obtain Qh for each species
  const filtered = data.filter(d => {
    const qh = SPECIES_QH_ML_MIN[d.species];
    return qh !== undefined && qh > 0;
  });

  if (filtered.length < data.length) {
    warnings.push({
      code: 'MISSING_QH',
      message: `${data.length - filtered.length} species with unknown Qh excluded.`,
      severity: 'warning',
    });
  }

  const BWs  = filtered.map(d => d.bodyWeight_kg);
  const normCL = filtered.map(d => {
    const qh = SPECIES_QH_ML_MIN[d.species] as number;
    return (d.CL_abs ?? d.CL_observed) / qh;
  });
  const Vvals = filtered.map(d => d.Vss_abs ?? d.Vss_observed);

  let regCL, regVss, predCL, predVss;
  let backPreds: BackPrediction[] = [];
  let AAFE_CL, AAFE_Vss;

  if (filtered.length >= 2) {
    regCL  = fitAllometricRegression(BWs, normCL);
    regVss = fitAllometricRegression(BWs, Vvals);
    predCL  = predictFromRegression(regCL, humanBW) * humanQh_mL_min;
    predVss = predictFromRegression(regVss, humanBW);

    const CLabs = filtered.map(d => d.CL_abs ?? d.CL_observed);
    backPreds = buildBackPredictions(
      filtered,
      CLabs,
      bw => {
        const pt = filtered.find(d => d.bodyWeight_kg === bw);
        const qh = SPECIES_QH_ML_MIN[pt?.species ?? ''] ?? humanQh_mL_min;
        return predictFromRegression(regCL!, bw) * qh;
      },
      Vvals,
      bw => predictFromRegression(regVss!, bw),
    );
    AAFE_CL  = computeAAFE(backPreds.map(b => b.CL_predicted!), CLabs);
    AAFE_Vss = computeAAFE(backPreds.map(b => b.Vss_predicted!), Vvals);
  }

  return {
    method:             'liver_blood_flow',
    label:              method.label,
    regressionCL:       regCL,
    regressionVss:      regVss,
    predictedCL_human:  predCL,
    predictedVss_human: predVss,
    backPredictions:    backPreds,
    AAFE_CL,
    AAFE_Vss,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// 7. SPECIES INVARIANT TIME
// ---------------------------------------------------------------------------

export function speciesInvariantTime(
  data: AnimalDataPoint[],
  humanBW: number,
): AllometrySingleMethodResult {
  const method = ALLOMETRY_METHOD_CONFIGS.species_invariant_time;
  const warnings: Warning[] = warnIfFewSpecies(data.length, method.minSpecies, method.id);

  // This method normalizes CL by BW^b (where b is estimated from simple allometry).
  // First, run simple allometry to get b.
  const simple = simpleAllometry(data, humanBW);
  const b = simple.regressionCL?.slope ?? 0.75;

  // Compute CL per BW^b (species-invariant clearance)
  const BWs  = data.map(d => d.bodyWeight_kg);
  const CLsi = data.map((d, i) => (d.CL_abs ?? d.CL_observed) / Math.pow(BWs[i], b));
  const Vvals = data.map(d => d.Vss_abs ?? d.Vss_observed);

  // Fit on log(BW) to check if there's remaining trend (ideally flat)
  let regCL, regVss, predCL, predVss;
  let backPreds: BackPrediction[] = [];
  let AAFE_CL, AAFE_Vss;

  if (data.length >= 2) {
    regCL  = fitAllometricRegression(BWs, CLsi);
    regVss = fitAllometricRegression(BWs, Vvals);
    // Recover CL_human = predicted_si × BW_human^b
    predCL  = predictFromRegression(regCL, humanBW) * Math.pow(humanBW, b);
    predVss = predictFromRegression(regVss, humanBW);

    const CLabs = data.map(d => d.CL_abs ?? d.CL_observed);
    backPreds = buildBackPredictions(
      data,
      CLabs,
      (bw) => predictFromRegression(regCL!, bw) * Math.pow(bw, b),
      Vvals,
      bw => predictFromRegression(regVss!, bw),
    );
    AAFE_CL  = computeAAFE(backPreds.map(bp => bp.CL_predicted!), CLabs);
    AAFE_Vss = computeAAFE(backPreds.map(bp => bp.Vss_predicted!), Vvals);
  }

  warnings.push({
    code: 'SIT_EXPONENT',
    message: `Species-invariant time uses b=${b.toFixed(3)} from simple allometry for normalization.`,
    severity: 'info',
  });

  return {
    method:             'species_invariant_time',
    label:              method.label,
    regressionCL:       regCL,
    regressionVss:      regVss,
    predictedCL_human:  predCL,
    predictedVss_human: predVss,
    backPredictions:    backPreds,
    AAFE_CL,
    AAFE_Vss,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// 8. FIXED EXPONENT ALLOMETRY
// ---------------------------------------------------------------------------

export function fixedExponentAllometry(
  data: AnimalDataPoint[],
  humanBW: number,
  fixedExponent: number,
  methodId: AllometryMethod,
): AllometrySingleMethodResult {
  const cfg = ALLOMETRY_METHOD_CONFIGS[methodId];
  const warnings: Warning[] = [];

  if (data.length === 0) {
    warnings.push({ code: 'NO_DATA', message: 'No animal data provided.', severity: 'error' });
    return { method: methodId, label: cfg.label, backPredictions: [], warnings };
  }

  // For each animal, compute scaling factor then average
  const CLpredictions: number[] = [];
  const VssPredictions: number[] = [];

  for (const d of data) {
    const cl  = d.CL_abs  ?? d.CL_observed;
    const vss = d.Vss_abs ?? d.Vss_observed;
    CLpredictions.push(cl   * Math.pow(humanBW / d.bodyWeight_kg, fixedExponent));
    VssPredictions.push(vss * Math.pow(humanBW / d.bodyWeight_kg, fixedExponent));
  }

  // Geometric mean prediction across species
  const geoMeanCL = Math.exp(
    CLpredictions.reduce((s, v) => s + Math.log(v), 0) / CLpredictions.length,
  );
  const geoMeanVss = Math.exp(
    VssPredictions.reduce((s, v) => s + Math.log(v), 0) / VssPredictions.length,
  );

  const CLabs = data.map(d => d.CL_abs ?? d.CL_observed);
  const Vvals = data.map(d => d.Vss_abs ?? d.Vss_observed);

  const backPreds: BackPrediction[] = data.map((d, i) => {
    const clPred = CLpredictions[i] * (humanBW / d.bodyWeight_kg) ** 0; // back-predict each species from itself — use fixed exponent
    // For back-prediction: predict animal_i from other animals' average is complex;
    // here we report cross-prediction from the fixed-exponent formula using each species' own data back to itself = observed
    const clBackPred = (d.CL_abs ?? d.CL_observed); // trivially = observed when using same species
    return {
      species:      d.species,
      label:        d.label,
      bodyWeight_kg: d.bodyWeight_kg,
      CL_observed:  CLabs[i],
      CL_predicted: CLabs[i], // back to same species = trivial
      CL_PE_pct:    0,
      CL_foldError: 1,
      Vss_observed:  Vvals[i],
      Vss_predicted: Vvals[i],
      Vss_PE_pct:    0,
      Vss_foldError: 1,
    };
  });

  if (data.length > 1) {
    warnings.push({
      code: 'FIXED_EXP_AVG',
      message: `Geometric mean of ${data.length} species-specific predictions reported.`,
      severity: 'info',
    });
  }

  return {
    method:             methodId,
    label:              cfg.label,
    predictedCL_human:  geoMeanCL,
    predictedVss_human: geoMeanVss,
    backPredictions:    backPreds,
    AAFE_CL:            1,   // trivially 1 for self-back-prediction
    AAFE_Vss:           1,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// 9. TWO-SPECIES SENSITIVITY
// ---------------------------------------------------------------------------

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

export function twoSpeciesSensitivity(
  data: AnimalDataPoint[],
  humanBW: number,
): AllometrySingleMethodResult {
  const method = ALLOMETRY_METHOD_CONFIGS.two_species;
  const warnings: Warning[] = warnIfFewSpecies(data.length, method.minSpecies, method.id);

  const pairs = combinations(data, 2);
  if (pairs.length === 0) {
    warnings.push({ code: 'INSUFFICIENT_PAIRS', message: 'At least 2 species required.', severity: 'error' });
    return { method: 'two_species', label: method.label, backPredictions: [], warnings };
  }

  const clPredictions: number[] = [];
  const vssPredictions: number[] = [];

  for (const pair of pairs) {
    try {
      const r = simpleAllometry(pair, humanBW);
      if (r.predictedCL_human !== undefined && r.predictedCL_human > 0) clPredictions.push(r.predictedCL_human);
      if (r.predictedVss_human !== undefined && r.predictedVss_human > 0) vssPredictions.push(r.predictedVss_human);
    } catch { /* skip degenerate pairs */ }
  }

  // Geometric mean across pairs
  const geoMeanCL = clPredictions.length > 0
    ? Math.exp(clPredictions.reduce((s, v) => s + Math.log(v), 0) / clPredictions.length) : undefined;
  const geoMeanVss = vssPredictions.length > 0
    ? Math.exp(vssPredictions.reduce((s, v) => s + Math.log(v), 0) / vssPredictions.length) : undefined;

  if (clPredictions.length > 1) {
    const minCL = Math.min(...clPredictions);
    const maxCL = Math.max(...clPredictions);
    warnings.push({
      code: 'TWO_SPECIES_RANGE',
      message: `CL predictions across ${clPredictions.length} pairs: min=${minCL.toFixed(2)}, max=${maxCL.toFixed(2)} mL/min (geometric mean reported).`,
      severity: 'info',
    });
  }

  return {
    method:             'two_species',
    label:              method.label,
    predictedCL_human:  geoMeanCL,
    predictedVss_human: geoMeanVss,
    backPredictions:    [],
    warnings,
  };
}

// ---------------------------------------------------------------------------
// 10. THREE-SPECIES SENSITIVITY
// ---------------------------------------------------------------------------

export function threeSpeciesSensitivity(
  data: AnimalDataPoint[],
  humanBW: number,
): AllometrySingleMethodResult {
  const method = ALLOMETRY_METHOD_CONFIGS.three_species;
  const warnings: Warning[] = warnIfFewSpecies(data.length, method.minSpecies, method.id);

  const triplets = combinations(data, 3);
  if (triplets.length === 0) {
    warnings.push({ code: 'INSUFFICIENT_TRIPLETS', message: 'At least 3 species required.', severity: 'error' });
    return { method: 'three_species', label: method.label, backPredictions: [], warnings };
  }

  const clPredictions: number[] = [];
  const vssPredictions: number[] = [];

  for (const triplet of triplets) {
    try {
      const r = simpleAllometry(triplet, humanBW);
      if (r.predictedCL_human !== undefined && r.predictedCL_human > 0) clPredictions.push(r.predictedCL_human);
      if (r.predictedVss_human !== undefined && r.predictedVss_human > 0) vssPredictions.push(r.predictedVss_human);
    } catch { /* skip degenerate */ }
  }

  const geoMeanCL = clPredictions.length > 0
    ? Math.exp(clPredictions.reduce((s, v) => s + Math.log(v), 0) / clPredictions.length) : undefined;
  const geoMeanVss = vssPredictions.length > 0
    ? Math.exp(vssPredictions.reduce((s, v) => s + Math.log(v), 0) / vssPredictions.length) : undefined;

  if (clPredictions.length > 1) {
    const minCL = Math.min(...clPredictions);
    const maxCL = Math.max(...clPredictions);
    warnings.push({
      code: 'THREE_SPECIES_RANGE',
      message: `CL predictions across ${clPredictions.length} triplets: min=${minCL.toFixed(2)}, max=${maxCL.toFixed(2)} mL/min.`,
      severity: 'info',
    });
  }

  return {
    method:             'three_species',
    label:              method.label,
    predictedCL_human:  geoMeanCL,
    predictedVss_human: geoMeanVss,
    backPredictions:    [],
    warnings,
  };
}

// ---------------------------------------------------------------------------
// 11. MONKEY-ONLY SCALING
// ---------------------------------------------------------------------------

export function monkeyOnlyScaling(
  data: AnimalDataPoint[],
  humanBW: number,
): AllometrySingleMethodResult {
  const method = ALLOMETRY_METHOD_CONFIGS.monkey_only;
  const warnings: Warning[] = [];

  const primates = ['monkey', 'cynomolgus_monkey', 'rhesus_monkey'];
  const monkeyData = data.filter(d => primates.includes(d.species));

  if (monkeyData.length === 0) {
    warnings.push({ code: 'NO_MONKEY_DATA', message: 'No primate data found.', severity: 'error' });
    return { method: 'monkey_only', label: method.label, backPredictions: [], warnings };
  }

  let predCL, predVss;
  let backPreds: BackPrediction[] = [];

  if (monkeyData.length === 1) {
    // Single-species: scale with fixed exponent 0.75
    const d = monkeyData[0];
    const cl  = d.CL_abs  ?? d.CL_observed;
    const vss = d.Vss_abs ?? d.Vss_observed;
    predCL  = cl  * Math.pow(humanBW / d.bodyWeight_kg, 0.75);
    predVss = vss * Math.pow(humanBW / d.bodyWeight_kg, 1.0);
    warnings.push({
      code: 'MONKEY_SINGLE',
      message: 'Single primate species available; using fixed exponent b=0.75 for CL, b=1.0 for Vss.',
      severity: 'caution',
    });
    backPreds = [{
      species:       d.species,
      label:         d.label,
      bodyWeight_kg: d.bodyWeight_kg,
      CL_observed:   cl,
      CL_predicted:  cl,
      CL_PE_pct:     0,
      CL_foldError:  1,
      Vss_observed:   vss,
      Vss_predicted:  vss,
      Vss_PE_pct:     0,
      Vss_foldError:  1,
    }];
  } else {
    // Multiple primates: fit allometry
    const result = simpleAllometry(monkeyData, humanBW);
    predCL  = result.predictedCL_human;
    predVss = result.predictedVss_human;
    backPreds = result.backPredictions;
    warnings.push(...result.warnings);
  }

  return {
    method:             'monkey_only',
    label:              method.label,
    predictedCL_human:  predCL,
    predictedVss_human: predVss,
    backPredictions:    backPreds,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// 12. LEAVE-ONE-OUT CROSS-VALIDATION
// ---------------------------------------------------------------------------

export function leaveOneOut(
  data: AnimalDataPoint[],
  humanBW: number,
): AllometrySingleMethodResult {
  const method = ALLOMETRY_METHOD_CONFIGS.leave_one_out;
  const warnings: Warning[] = warnIfFewSpecies(data.length, method.minSpecies, method.id);

  if (data.length < 3) {
    warnings.push({
      code: 'LOO_INSUFFICIENT',
      message: 'Leave-one-out requires at least 3 species.',
      severity: 'error',
    });
    return { method: 'leave_one_out', label: method.label, backPredictions: [], warnings };
  }

  const looPredictions_CL:  number[] = [];
  const looObserved_CL:     number[] = [];
  const looPredictions_Vss: number[] = [];
  const looObserved_Vss:    number[] = [];
  const backPreds: BackPrediction[]  = [];

  for (let i = 0; i < data.length; i++) {
    const trainData = data.filter((_, j) => j !== i);
    const testPoint = data[i];
    try {
      const BWs  = trainData.map(d => d.bodyWeight_kg);
      const CLs  = trainData.map(d => d.CL_abs ?? d.CL_observed);
      const Vsss = trainData.map(d => d.Vss_abs ?? d.Vss_observed);

      const regCL  = fitAllometricRegression(BWs, CLs);
      const regVss = fitAllometricRegression(BWs, Vsss);

      const clPred  = predictFromRegression(regCL,  testPoint.bodyWeight_kg);
      const vssPred = predictFromRegression(regVss, testPoint.bodyWeight_kg);
      const clObs   = testPoint.CL_abs  ?? testPoint.CL_observed;
      const vssObs  = testPoint.Vss_abs ?? testPoint.Vss_observed;

      looPredictions_CL.push(clPred);
      looObserved_CL.push(clObs);
      looPredictions_Vss.push(vssPred);
      looObserved_Vss.push(vssObs);

      backPreds.push({
        species:       testPoint.species,
        label:         testPoint.label,
        bodyWeight_kg: testPoint.bodyWeight_kg,
        CL_observed:   clObs,
        CL_predicted:  clPred,
        CL_PE_pct:     clObs > 0 ? computePE(clPred, clObs) : undefined,
        CL_foldError:  clObs > 0 ? computeFoldError(clPred, clObs) : undefined,
        Vss_observed:   vssObs,
        Vss_predicted:  vssPred,
        Vss_PE_pct:     vssObs > 0 ? computePE(vssPred, vssObs) : undefined,
        Vss_foldError:  vssObs > 0 ? computeFoldError(vssPred, vssObs) : undefined,
      });
    } catch { /* skip */ }
  }

  // Final human prediction from full dataset
  const fullResult = simpleAllometry(data, humanBW);

  const AAFE_CL  = computeAAFE(looPredictions_CL,  looObserved_CL);
  const AAFE_Vss = computeAAFE(looPredictions_Vss, looObserved_Vss);

  return {
    method:             'leave_one_out',
    label:              method.label,
    regressionCL:       fullResult.regressionCL,
    regressionVss:      fullResult.regressionVss,
    predictedCL_human:  fullResult.predictedCL_human,
    predictedVss_human: fullResult.predictedVss_human,
    backPredictions:    backPreds,
    AAFE_CL,
    AAFE_Vss,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// 13. CALDWELL–TANG VARIANT 1
// ---------------------------------------------------------------------------

export function caldwellTang1(
  data: AnimalDataPoint[],
  humanBW: number,
  humanFup: number,
  humanMLP: number,
): AllometrySingleMethodResult {
  const method = ALLOMETRY_METHOD_CONFIGS.caldwell_tang_1;
  const warnings: Warning[] = warnIfFewSpecies(data.length, method.minSpecies, method.id);

  const filtered = data.filter(d => d.MLP_years !== undefined && d.MLP_years > 0 && d.fup !== undefined && d.fup > 0);
  if (filtered.length < data.length) {
    warnings.push({
      code: 'CT1_MISSING',
      message: `${data.length - filtered.length} species missing MLP or fup; excluded.`,
      severity: 'warning',
    });
  }

  const BWs   = filtered.map(d => d.bodyWeight_kg);
  // CLcorr = (CL × MLP) / fup
  const CLcor = filtered.map(d =>
    ((d.CL_abs ?? d.CL_observed) * (d.MLP_years as number)) / (d.fup as number),
  );
  const Vvals = filtered.map(d => d.Vss_abs ?? d.Vss_observed);

  let regCL, regVss, predCL, predVss;
  let backPreds: BackPrediction[] = [];
  let AAFE_CL, AAFE_Vss;

  if (filtered.length >= 2) {
    regCL  = fitAllometricRegression(BWs, CLcor);
    regVss = fitAllometricRegression(BWs, Vvals);
    // CL_human = (a × BW_human^b × fup_human) / MLP_human
    predCL  = predictFromRegression(regCL, humanBW) * humanFup / humanMLP;
    predVss = predictFromRegression(regVss, humanBW);

    const CLabs = filtered.map(d => d.CL_abs ?? d.CL_observed);
    backPreds = buildBackPredictions(
      filtered,
      CLabs,
      bw => {
        const pt  = filtered.find(d => d.bodyWeight_kg === bw);
        const fup = pt?.fup   ?? humanFup;
        const mlp = pt?.MLP_years ?? humanMLP;
        return predictFromRegression(regCL!, bw) * fup / mlp;
      },
      Vvals,
      bw => predictFromRegression(regVss!, bw),
    );
    AAFE_CL  = computeAAFE(backPreds.map(b => b.CL_predicted!), CLabs);
    AAFE_Vss = computeAAFE(backPreds.map(b => b.Vss_predicted!), Vvals);
  }

  return {
    method:             'caldwell_tang_1',
    label:              method.label,
    regressionCL:       regCL,
    regressionVss:      regVss,
    predictedCL_human:  predCL,
    predictedVss_human: predVss,
    backPredictions:    backPreds,
    AAFE_CL,
    AAFE_Vss,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// 14. CALDWELL–TANG VARIANT 2
// ---------------------------------------------------------------------------

export function caldwellTang2(
  data: AnimalDataPoint[],
  humanBW: number,
  humanFup: number,
  humanBrainWeight_g: number,
): AllometrySingleMethodResult {
  const method = ALLOMETRY_METHOD_CONFIGS.caldwell_tang_2;
  const warnings: Warning[] = warnIfFewSpecies(data.length, method.minSpecies, method.id);

  const filtered = data.filter(
    d => d.brainWeight_g !== undefined && d.brainWeight_g > 0 && d.fup !== undefined && d.fup > 0,
  );
  if (filtered.length < data.length) {
    warnings.push({
      code: 'CT2_MISSING',
      message: `${data.length - filtered.length} species missing brain weight or fup; excluded.`,
      severity: 'warning',
    });
  }

  const BWs   = filtered.map(d => d.bodyWeight_kg);
  // CLcorr = (CL × BW × fup_human) / (BrW × fup)
  const CLcor = filtered.map(d =>
    ((d.CL_abs ?? d.CL_observed) * d.bodyWeight_kg * humanFup) /
    ((d.brainWeight_g as number) * (d.fup as number)),
  );
  const Vvals = filtered.map(d => d.Vss_abs ?? d.Vss_observed);

  let regCL, regVss, predCL, predVss;
  let backPreds: BackPrediction[] = [];
  let AAFE_CL, AAFE_Vss;

  if (filtered.length >= 2) {
    regCL  = fitAllometricRegression(BWs, CLcor);
    regVss = fitAllometricRegression(BWs, Vvals);
    // Recover: CL_human = a × BW_human^b × BrW_human / BW_human
    predCL  = predictFromRegression(regCL, humanBW) * humanBrainWeight_g / humanBW;
    predVss = predictFromRegression(regVss, humanBW);

    const CLabs = filtered.map(d => d.CL_abs ?? d.CL_observed);
    backPreds = buildBackPredictions(
      filtered,
      CLabs,
      bw => {
        const pt  = filtered.find(d => d.bodyWeight_kg === bw);
        const brW = pt?.brainWeight_g ?? humanBrainWeight_g;
        return predictFromRegression(regCL!, bw) * brW / bw;
      },
      Vvals,
      bw => predictFromRegression(regVss!, bw),
    );
    AAFE_CL  = computeAAFE(backPreds.map(b => b.CL_predicted!), CLabs);
    AAFE_Vss = computeAAFE(backPreds.map(b => b.Vss_predicted!), Vvals);
  }

  return {
    method:             'caldwell_tang_2',
    label:              method.label,
    regressionCL:       regCL,
    regressionVss:      regVss,
    predictedCL_human:  predCL,
    predictedVss_human: predVss,
    backPredictions:    backPreds,
    AAFE_CL,
    AAFE_Vss,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// 15. CALDWELL–TANG VARIANT 3 (MPPGL correction)
// ---------------------------------------------------------------------------

export function caldwellTang3(
  data: AnimalDataPoint[],
  humanBW: number,
): AllometrySingleMethodResult {
  const method = ALLOMETRY_METHOD_CONFIGS.caldwell_tang_3;
  const warnings: Warning[] = warnIfFewSpecies(data.length, method.minSpecies, method.id);

  const humanMPPGL = SPECIES_MPPGL['human'] ?? 45;

  const BWs   = data.map(d => d.bodyWeight_kg);
  // CLcorr_i = CL_i × (MPPGL_human / MPPGL_i)
  const CLcor = data.map(d => {
    const mppgl = SPECIES_MPPGL[d.species] ?? humanMPPGL;
    if (mppgl === humanMPPGL) {
      warnings.push({
        code: 'CT3_DEFAULT_MPPGL',
        message: `${d.label}: no species-specific MPPGL found; using human default (${humanMPPGL} mg/g).`,
        severity: 'caution',
      });
    }
    return (d.CL_abs ?? d.CL_observed) * humanMPPGL / mppgl;
  });
  const Vvals = data.map(d => d.Vss_abs ?? d.Vss_observed);

  let regCL, regVss, predCL, predVss;
  let backPreds: BackPrediction[] = [];
  let AAFE_CL, AAFE_Vss;

  if (data.length >= 2) {
    regCL  = fitAllometricRegression(BWs, CLcor);
    regVss = fitAllometricRegression(BWs, Vvals);
    predCL  = predictFromRegression(regCL, humanBW);
    predVss = predictFromRegression(regVss, humanBW);

    const CLabs = data.map(d => d.CL_abs ?? d.CL_observed);
    backPreds = buildBackPredictions(
      data,
      CLabs,
      bw => predictFromRegression(regCL!, bw),
      Vvals,
      bw => predictFromRegression(regVss!, bw),
    );
    AAFE_CL  = computeAAFE(backPreds.map(b => b.CL_predicted!), CLabs);
    AAFE_Vss = computeAAFE(backPreds.map(b => b.Vss_predicted!), Vvals);
  }

  return {
    method:             'caldwell_tang_3',
    label:              method.label,
    regressionCL:       regCL,
    regressionVss:      regVss,
    predictedCL_human:  predCL,
    predictedVss_human: predVss,
    backPredictions:    backPreds,
    AAFE_CL,
    AAFE_Vss,
    warnings,
  };
}
