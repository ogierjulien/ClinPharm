/**
 * DDI CYP induction assessment.
 *
 * Models fold induction using the Emax sigmoid model and evaluates regulatory
 * risk thresholds (FDA and EMA approaches).
 *
 * References:
 *   FDA (2020) Drug Interaction Studies Guidance for Industry
 *   EMA (2012) Guideline on the Investigation of Drug Interactions
 *   Fahmi et al. (2008) Drug Metab Dispos 36:1971–1974
 */

import type {
  CYPEnzyme,
  DDIPathwayResult,
  DDIRiskLevel,
  InductionData,
  Warning,
} from '@/types';

// ---------------------------------------------------------------------------
// FOLD INDUCTION — EMAX MODEL
// ---------------------------------------------------------------------------

/**
 * Calculate fold induction using the Emax (Hill, n=1) model.
 *
 * Fold induction = 1 + (Emax × I) / (EC50 + I)
 *
 * @param Emax  Maximum fold induction above baseline
 * @param EC50  Concentration producing half-maximum induction (µM)
 * @param I     Inhibitor/inducer concentration at the site (µM)
 */
export function foldInduction(Emax: number, EC50: number, I: number): number {
  if (Emax < 0) throw new Error(`foldInduction: Emax must be ≥ 0, got ${Emax}`);
  if (EC50 < 0) throw new Error(`foldInduction: EC50 must be ≥ 0, got ${EC50}`);
  if (I    < 0) throw new Error(`foldInduction: I must be ≥ 0, got ${I}`);
  const denom = EC50 + I;
  if (denom <= 0) throw new Error('foldInduction: EC50 + I must be positive');
  return 1 + (Emax * I) / denom;
}

/**
 * EMA R3 value for induction risk assessment.
 *
 * R3 = 1 + (Emax × Iu_max) / ((EC50 + Iu_max) × d)
 *
 * where d is a calibration factor for the assay system (default d = 1 for
 * mRNA induction; some guidance uses d for translation factors).
 *
 * Risk if R3 ≥ 1.0 (conservative; practical threshold often R3 ≥ 1.25 or
 * fold ≥ 2).
 *
 * @param Emax    Maximum induction fold
 * @param EC50    EC50 for induction (µM)
 * @param Iu_max  Maximum unbound inducer concentration (µM)
 * @param d       Degradation scaling factor (default 1)
 */
export function R3_induction(
  Emax: number,
  EC50: number,
  Iu_max: number,
  d: number = 1,
): number {
  if (d <= 0) throw new Error(`R3_induction: d must be positive, got ${d}`);
  const denom = (EC50 + Iu_max) * d;
  if (denom <= 0) throw new Error('R3_induction: (EC50 + Iu_max) × d must be positive');
  return 1 + (Emax * Iu_max) / denom;
}

// ---------------------------------------------------------------------------
// FULL INDUCTION ASSESSMENT
// ---------------------------------------------------------------------------

/**
 * Assess CYP induction risk for all provided induction datasets.
 *
 * Risk determination:
 *   - FDA: fold induction at Iu_max ≥ threshold_fold → risk
 *   - EMA: R3 value > 1.0 → investigate further; fold ≥ 2 → risk
 *
 * @param induction       Array of InductionData
 * @param threshold_fold  Fold induction threshold for risk (default 2)
 */
export function assessInduction(
  induction: InductionData[],
  threshold_fold: number = 2,
): DDIPathwayResult[] {
  const results: DDIPathwayResult[] = [];

  for (const ind of induction) {
    const warnings: Warning[] = [];
    const { enzyme, Emax, EC50, Iu_max, d = 1 } = ind;

    // Validate inputs
    if (Emax < 0) {
      warnings.push({
        code: 'INVALID_EMAX',
        message: `Emax must be ≥ 0 for ${enzyme} (got ${Emax}).`,
        severity: 'error',
      });
    }
    if (EC50 <= 0) {
      warnings.push({
        code: 'INVALID_EC50',
        message: `EC50 must be positive for ${enzyme} (got ${EC50}).`,
        severity: 'error',
      });
    }
    if (Iu_max < 0) {
      warnings.push({
        code: 'INVALID_IU',
        message: `Iu_max must be ≥ 0 for ${enzyme} (got ${Iu_max}).`,
        severity: 'error',
      });
    }

    let fold: number;
    let R3: number;
    let risk: DDIRiskLevel;

    try {
      fold = foldInduction(Emax, EC50, Iu_max);
      R3   = R3_induction(Emax, EC50, Iu_max, d);
    } catch (err) {
      warnings.push({
        code: 'INDUCTION_CALC_ERROR',
        message: `Induction calculation failed for ${enzyme}: ${
          err instanceof Error ? err.message : String(err)
        }`,
        severity: 'error',
      });
      results.push({
        pathway:      String(enzyme),
        metric_name:  'Fold induction',
        metric_value: NaN,
        threshold:    threshold_fold,
        risk:         'no_risk',
        rationale:    'Calculation error',
        equation:     'Fold = 1 + (Emax × I) / (EC50 + I)',
        confidence:   'low',
        warnings,
      });
      continue;
    }

    // Risk classification
    // FDA: fold ≥ threshold_fold (default 2) at Iu_max → risk
    // EMA: R3 > 1.0 → further investigation; fold ≥ 2 → regulatory risk
    if (fold >= threshold_fold * 2.5 || (fold >= threshold_fold && R3 >= 2)) {
      risk = 'high_risk';
    } else if (fold >= threshold_fold || R3 > 1.0) {
      risk = 'risk';
    } else if (R3 > 0.9) {
      risk = 'potential_risk';
    } else {
      risk = 'no_risk';
    }

    if (Iu_max === 0) {
      warnings.push({
        code: 'IU_ZERO',
        message: `Iu_max = 0 for ${enzyme}; fold induction at zero concentration = 1 (no effect).`,
        severity: 'caution',
      });
    }

    results.push({
      pathway:      String(enzyme),
      metric_name:  'Fold induction',
      metric_value: fold,
      threshold:    threshold_fold,
      risk,
      rationale: `Fold induction at Iu_max=${Iu_max} µM: ${fold.toFixed(2)}-fold ` +
        `(threshold=${threshold_fold}-fold). ` +
        `EMA R3 = ${R3.toFixed(3)}. ` +
        `Emax=${Emax}, EC50=${EC50} µM.`,
      equation:     'Fold = 1 + (Emax × I) / (EC50 + I); R3 = 1 + (Emax × Iu) / ((EC50 + Iu) × d)',
      confidence:   'high',
      warnings,
    });
  }

  return results;
}
