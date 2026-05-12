/**
 * DDI reversible and time-dependent inhibition (TDI) assessment.
 *
 * Implements FDA and EMA static mechanistic models for CYP inhibition.
 *
 * References:
 *   FDA (2020) Drug Interaction Studies Guidance
 *   EMA (2012) Guideline on the Investigation of Drug Interactions
 *   Mayhew et al. (2000) Drug Metab Dispos 28:1031–1037
 *   Obach et al. (2006) J Pharmacol Exp Ther 316:336–348
 */

import type {
  CYPEnzyme,
  DDIPathwayResult,
  DDIRiskLevel,
  ReversibleInhibitorData,
  TDIData,
  Transporter,
  Warning,
} from '@/types';

// ---------------------------------------------------------------------------
// REVERSIBLE INHIBITION — R1 RATIO
// ---------------------------------------------------------------------------

/**
 * Compute R1 ratio for reversible CYP inhibition.
 *
 * R1 = 1 + Iu / Ki
 *
 * where Iu is the maximum unbound inhibitor concentration and Ki is the
 * inhibition constant.
 *
 * If only IC50 is provided, Ki is estimated as IC50 / 2 (Cheng-Prusoff,
 * competitive inhibition assumption).
 *
 * @param Iu  Unbound inhibitor concentration (µM)
 * @param Ki  Inhibition constant (µM)
 */
export function R1_ratio(Iu: number, Ki: number): number {
  if (Ki <= 0) throw new Error(`R1_ratio: Ki must be positive, got ${Ki}`);
  return 1 + Iu / Ki;
}

/**
 * Determine DDI risk level from R1 value.
 *
 * EMA threshold: R1 ≥ 1.02 → potential_risk / risk
 * FDA threshold: R1 ≥ 1.1  → potential_risk / risk
 *
 * Risk levels:
 *   R1 ≥ 2×threshold → risk
 *   threshold ≤ R1 < 2×threshold → potential_risk
 *   R1 < threshold → no_risk
 *
 * @param R1        Computed R1 ratio
 * @param threshold Regulatory threshold (1.02 for EMA, 1.1 for FDA)
 */
export function R1_risk(R1: number, threshold: number): DDIRiskLevel {
  if (R1 >= threshold * 2) return 'risk';
  if (R1 >= threshold)    return 'potential_risk';
  return 'no_risk';
}

// ---------------------------------------------------------------------------
// TIME-DEPENDENT INHIBITION (TDI / MBI)
// ---------------------------------------------------------------------------

/**
 * First-order rate constant for TDI inactivation of a CYP enzyme.
 *
 * lambda = kinact × Iu / (KI + Iu)
 *
 * @param kinact  Maximum inactivation rate constant (h⁻¹)
 * @param KI      Inhibitor concentration producing half-maximum inactivation (µM)
 * @param Iu      Unbound inhibitor concentration at the site (µM)
 */
export function TDI_lambda(kinact: number, KI: number, Iu: number): number {
  if (KI < 0) throw new Error(`TDI_lambda: KI must be non-negative, got ${KI}`);
  if (kinact < 0) throw new Error(`TDI_lambda: kinact must be non-negative, got ${kinact}`);
  const denom = KI + Iu;
  if (denom <= 0) throw new Error('TDI_lambda: KI + Iu must be positive');
  return (kinact * Iu) / denom;
}

/**
 * Fraction of CYP enzyme remaining active after TDI (steady-state).
 *
 * At steady state: Remaining = kdeg / (kdeg + lambda)
 *
 * @param kdeg    First-order CYP degradation rate constant (h⁻¹)
 * @param lambda  Inactivation rate constant (h⁻¹) from TDI_lambda()
 */
export function TDI_remainingActivity(kdeg: number, lambda: number): number {
  if (kdeg < 0) throw new Error(`TDI_remainingActivity: kdeg must be non-negative, got ${kdeg}`);
  if (lambda < 0) throw new Error(`TDI_remainingActivity: lambda must be non-negative`);
  const denom = kdeg + lambda;
  if (denom <= 0) throw new Error('TDI_remainingActivity: kdeg + lambda must be positive');
  return kdeg / denom;
}

/**
 * R2 ratio for mechanism-based (time-dependent) inhibition.
 *
 * R2 = (kdeg + lambda) / kdeg  =  1 / TDI_remainingActivity
 *
 * Risk threshold: R2 ≥ 1.25 (EMA/FDA default)
 *
 * @param kdeg    CYP degradation rate constant (h⁻¹)
 * @param lambda  Inactivation rate from TDI_lambda() (h⁻¹)
 */
export function R2_ratio(kdeg: number, lambda: number): number {
  const remaining = TDI_remainingActivity(kdeg, lambda);
  if (remaining <= 0) return Infinity;
  return 1 / remaining;
}

/**
 * Combined R value for reversible + TDI inhibition.
 *
 * R_combined = R1 × R2
 *
 * Note: This is a multiplicative model; in practice the FDA/EMA treat them
 * separately, but the product provides a conservative combined estimate.
 */
export function R1R2_combined(R1: number, R2: number): number {
  return R1 * R2;
}

// ---------------------------------------------------------------------------
// Ki from IC50
// ---------------------------------------------------------------------------

/**
 * Estimate Ki from IC50 using the Cheng-Prusoff approximation (competitive inhibition).
 *
 * Ki ≈ IC50 / (1 + [S] / Km)
 *
 * For typical in vitro screening assays at substrate concentrations << Km:
 * Ki ≈ IC50 / 2  (default ratio = 2 for competitive)
 *
 * @param IC50          Measured IC50 (µM)
 * @param IC50_to_Ki    Ratio IC50/Ki (default 2 for competitive)
 */
export function Ki_from_IC50(IC50: number, IC50_to_Ki: number = 2): number {
  if (IC50_to_Ki <= 0) throw new Error('Ki_from_IC50: IC50_to_Ki must be positive');
  return IC50 / IC50_to_Ki;
}

// ---------------------------------------------------------------------------
// FULL REVERSIBLE INHIBITION ASSESSMENT
// ---------------------------------------------------------------------------

/**
 * Assess reversible CYP/transporter inhibition for an array of inhibitor datasets.
 *
 * Returns one DDIPathwayResult per inhibitor entry.
 *
 * @param inhibitors          Array of ReversibleInhibitorData
 * @param threshold_R1_EMA    EMA threshold for R1 (default 1.02)
 * @param threshold_R1_FDA    FDA threshold for R1 (default 1.1)
 */
export function assessReversibleInhibition(
  inhibitors: ReversibleInhibitorData[],
  threshold_R1_EMA: number = 1.02,
  threshold_R1_FDA: number = 1.1,
): DDIPathwayResult[] {
  const results: DDIPathwayResult[] = [];

  for (const inh of inhibitors) {
    const warnings: Warning[] = [];
    const { enzyme, Ki, IC50, Iu_max, Iu_inlet, mechanism, IC50_to_Ki_ratio } = inh;

    // Determine Ki
    let Ki_eff: number;
    if (Ki !== undefined && Ki > 0) {
      Ki_eff = Ki;
    } else if (IC50 !== undefined && IC50 > 0) {
      const ratio = IC50_to_Ki_ratio ?? 2;
      Ki_eff = Ki_from_IC50(IC50, ratio);
      warnings.push({
        code: 'KI_FROM_IC50',
        message: `Ki estimated from IC50/${ratio} = ${Ki_eff.toFixed(3)} µM (${mechanism} assumed).`,
        severity: 'info',
      });
    } else {
      warnings.push({
        code: 'MISSING_KI_IC50',
        message: `No Ki or IC50 provided for ${enzyme}; cannot compute R1.`,
        severity: 'error',
      });
      results.push({
        pathway:      String(enzyme),
        metric_name:  'R1',
        metric_value: NaN,
        threshold:    threshold_R1_EMA,
        risk:         'no_risk',
        rationale:    'Missing Ki/IC50',
        equation:     'R1 = 1 + Iu / Ki',
        confidence:   'low',
        warnings,
      });
      continue;
    }

    // Determine Iu (prefer inlet for hepatic enzymes if available)
    const Iu = Iu_inlet ?? Iu_max ?? 0;
    if (Iu === 0) {
      warnings.push({
        code: 'IU_ZERO',
        message: `Unbound inhibitor concentration Iu is 0 for ${enzyme}; R1 = 1 (no inhibition).`,
        severity: 'caution',
      });
    }

    const R1 = R1_ratio(Iu, Ki_eff);

    // Use EMA (more conservative) as primary; also report FDA
    const riskEMA = R1_risk(R1, threshold_R1_EMA);
    const riskFDA = R1_risk(R1, threshold_R1_FDA);

    // Take most severe risk
    const riskLevels: DDIRiskLevel[] = ['no_risk', 'potential_risk', 'risk', 'high_risk'];
    const risk = riskLevels[Math.max(riskLevels.indexOf(riskEMA), riskLevels.indexOf(riskFDA))];

    const confidence: 'high' | 'medium' | 'low' = Ki !== undefined ? 'high' : IC50 !== undefined ? 'medium' : 'low';

    results.push({
      pathway:      String(enzyme),
      metric_name:  'R1',
      metric_value: R1,
      threshold:    threshold_R1_EMA,
      risk,
      rationale:    `R1 = 1 + Iu/Ki = ${R1.toFixed(3)}. EMA threshold=${threshold_R1_EMA} (${riskEMA}); FDA threshold=${threshold_R1_FDA} (${riskFDA}). Ki=${Ki_eff.toFixed(3)} µM, Iu=${Iu.toFixed(4)} µM.`,
      equation:     'R1 = 1 + Iu / Ki',
      confidence,
      warnings,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// FULL TDI ASSESSMENT
// ---------------------------------------------------------------------------

/**
 * Assess time-dependent (mechanism-based) CYP inhibition.
 *
 * Returns one DDIPathwayResult per TDI entry.
 *
 * @param tdiData       Array of TDIData
 * @param threshold_R2  Risk threshold for R2 (default 1.25)
 */
export function assessTDI(
  tdiData: TDIData[],
  threshold_R2: number = 1.25,
): DDIPathwayResult[] {
  const results: DDIPathwayResult[] = [];

  for (const td of tdiData) {
    const warnings: Warning[] = [];
    const { enzyme, kinact, KI, Iu_max, kdeg } = td;

    let lambda: number;
    let R2: number;
    let remaining: number;

    try {
      lambda    = TDI_lambda(kinact, KI, Iu_max);
      remaining = TDI_remainingActivity(kdeg, lambda);
      R2        = 1 / remaining;
    } catch (err) {
      warnings.push({
        code: 'TDI_CALC_ERROR',
        message: `TDI calculation failed for ${enzyme}: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'error',
      });
      results.push({
        pathway:      String(enzyme),
        metric_name:  'R2',
        metric_value: NaN,
        threshold:    threshold_R2,
        risk:         'no_risk',
        rationale:    'Calculation error',
        equation:     'R2 = (kdeg + lambda) / kdeg; lambda = kinact × Iu / (KI + Iu)',
        confidence:   'low',
        warnings,
      });
      continue;
    }

    let risk: DDIRiskLevel;
    if (R2 >= threshold_R2 * 2) {
      risk = 'high_risk';
    } else if (R2 >= threshold_R2) {
      risk = 'risk';
    } else {
      risk = 'no_risk';
    }

    results.push({
      pathway:      String(enzyme),
      metric_name:  'R2',
      metric_value: R2,
      threshold:    threshold_R2,
      risk,
      rationale: `R2 = (kdeg + lambda) / kdeg = ${R2.toFixed(3)}. ` +
        `lambda = kinact × Iu / (KI + Iu) = ${lambda.toFixed(4)} h⁻¹. ` +
        `kdeg = ${kdeg} h⁻¹. Remaining CYP activity = ${(remaining * 100).toFixed(1)}%.`,
      equation:     'R2 = (kdeg + lambda) / kdeg; lambda = kinact × Iu / (KI + Iu)',
      confidence:   'high',
      warnings,
    });
  }

  return results;
}
