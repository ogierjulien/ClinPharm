/**
 * Combined Mechanistic Static Model for DDI prediction.
 *
 * Implements the combined mechanistic static model per FDA 2020 Drug Interaction
 * Guidance and EMA 2012 Guideline on the Investigation of Drug Interactions.
 *
 * The model combines reversible inhibition, time-dependent inhibition (TDI /
 * mechanism-based inactivation), and induction to estimate net CYP enzyme
 * activity and predict AUCR for a victim substrate.
 *
 * References:
 *   FDA (2020) Drug Interaction Studies Guidance for Industry
 *   EMA (2012) Guideline on the Investigation of Drug Interactions
 *   Fahmi et al. (2009) Drug Metab Dispos 37:47–55
 */

import type {
  MechanisticStaticInputs,
  MechanisticStaticResults,
  MechanisticStaticEnzymeResult,
  MechanisticStaticIntermediate,
  MechanisticStaticEnzymeInputs,
  DDIRiskLevel,
  Warning,
} from '@/types';

// ---------------------------------------------------------------------------
// Individual contribution functions
// ---------------------------------------------------------------------------

/**
 * Compute the reversible inhibition contribution for one enzyme.
 *
 * R_rev = 1 + Iu / Ki
 * activity_rev = 1 / R_rev = Ki / (Ki + Iu)
 *
 * @param Ki  Unbound inhibition constant (µM), must be > 0
 * @param Iu  Unbound inhibitor concentration (µM), must be ≥ 0
 */
export function computeReversibleContribution(
  Ki: number,
  Iu: number,
): { R_rev: number; activity_rev: number } {
  if (Ki <= 0) throw new Error(`computeReversibleContribution: Ki must be positive, got ${Ki}`);
  if (Iu < 0)  throw new Error(`computeReversibleContribution: Iu must be ≥ 0, got ${Iu}`);
  const R_rev      = 1 + Iu / Ki;
  const activity_rev = Ki / (Ki + Iu); // equiv. to 1 / R_rev
  return { R_rev, activity_rev };
}

/**
 * Compute the TDI (mechanism-based inactivation) contribution for one enzyme.
 *
 * lambda   = kinact × Iu / (KI + Iu)
 * R_TDI    = (kdeg + lambda) / kdeg
 * activity_TDI = kdeg / (kdeg + lambda) = 1 / R_TDI
 *
 * @param kinact  Maximum inactivation rate constant (h⁻¹), must be ≥ 0
 * @param KI      Inhibitor concentration for half-maximal inactivation (µM), must be ≥ 0
 * @param Iu      Unbound inhibitor concentration (µM), must be ≥ 0
 * @param kdeg    CYP degradation rate constant (h⁻¹), must be > 0
 */
export function computeTDIContribution(
  kinact: number,
  KI: number,
  Iu: number,
  kdeg: number,
): { lambda: number; R_TDI: number; activity_TDI: number } {
  if (kinact < 0) throw new Error(`computeTDIContribution: kinact must be ≥ 0, got ${kinact}`);
  if (KI < 0)     throw new Error(`computeTDIContribution: KI must be ≥ 0, got ${KI}`);
  if (Iu < 0)     throw new Error(`computeTDIContribution: Iu must be ≥ 0, got ${Iu}`);
  if (kdeg <= 0)  throw new Error(`computeTDIContribution: kdeg must be positive, got ${kdeg}`);

  const denom = KI + Iu;
  if (denom <= 0) throw new Error('computeTDIContribution: KI + Iu must be positive');

  const lambda       = (kinact * Iu) / denom;
  const R_TDI        = (kdeg + lambda) / kdeg;
  const activity_TDI = kdeg / (kdeg + lambda); // 1 / R_TDI
  return { lambda, R_TDI, activity_TDI };
}

/**
 * Compute the induction contribution for one enzyme.
 *
 * fold_induction = 1 + Emax × Iu / (EC50 + Iu)
 *
 * When Emax = 0 or Iu = 0, returns 1.0 (no induction).
 *
 * @param Emax  Maximum fold induction above baseline, must be ≥ 0
 * @param EC50  Concentration for half-maximal induction (µM), must be ≥ 0
 * @param Iu    Unbound inducer concentration (µM), must be ≥ 0
 */
export function computeInductionContribution(
  Emax: number,
  EC50: number,
  Iu: number,
): { fold_induction: number } {
  if (Emax < 0) throw new Error(`computeInductionContribution: Emax must be ≥ 0, got ${Emax}`);
  if (EC50 < 0) throw new Error(`computeInductionContribution: EC50 must be ≥ 0, got ${EC50}`);
  if (Iu < 0)   throw new Error(`computeInductionContribution: Iu must be ≥ 0, got ${Iu}`);

  // Guard: if EC50 + Iu = 0, fold = 1 (Iu = 0 case, no drug present)
  const denom = EC50 + Iu;
  if (denom <= 0) return { fold_induction: 1 };

  const fold_induction = 1 + (Emax * Iu) / denom;
  return { fold_induction };
}

// ---------------------------------------------------------------------------
// Risk classification
// ---------------------------------------------------------------------------

/**
 * Classify DDI risk from an AUCR value.
 *
 * AUCR ≥ 5        → 'high_risk'   (strong inhibition; sensitive substrate flag)
 * AUCR ≥ 2        → 'risk'        (moderate-strong inhibition)
 * AUCR ≥ 1.25     → 'potential_risk'
 * 0.8 < AUCR < 1.25 → 'no_risk'
 * AUCR ≤ 0.8      → 'risk'        (strong induction; substrate AUC reduced ≥ 20%)
 */
export function classifyAUCR(AUCR: number): DDIRiskLevel {
  if (AUCR >= 5)    return 'high_risk';
  if (AUCR >= 2)    return 'risk';
  if (AUCR >= 1.25) return 'potential_risk';
  if (AUCR > 0.8)   return 'no_risk';
  // AUCR ≤ 0.8 — strong induction
  return 'risk';
}

function riskLabel(risk: DDIRiskLevel): string {
  const map: Record<DDIRiskLevel, string> = {
    no_risk:       'No DDI Risk',
    potential_risk:'Potential DDI Risk',
    risk:          'DDI Risk',
    high_risk:     'High DDI Risk',
  };
  return map[risk];
}

// ---------------------------------------------------------------------------
// Per-enzyme computation
// ---------------------------------------------------------------------------

function computeEnzymeResult(enz: MechanisticStaticEnzymeInputs): MechanisticStaticEnzymeResult {
  const warnings: Warning[] = [];

  let R_rev     = 1;
  let activity_rev: number | undefined;
  let lambda: number | undefined;
  let R_TDI     = 1;
  let activity_TDI: number | undefined;
  let fold_induction = 1;

  // --- Reversible inhibition ---
  if (enz.useReversible) {
    const Ki = enz.Ki_rev;
    const Iu = enz.Iu_rev ?? 0;

    if (Ki === undefined || Ki <= 0) {
      warnings.push({
        code: 'MSM_REV_MISSING_KI',
        message: `Reversible inhibition checked for ${enz.enzyme} but Ki is missing or zero; contribution skipped.`,
        severity: 'caution',
      });
    } else {
      try {
        const rev = computeReversibleContribution(Ki, Iu);
        R_rev      = rev.R_rev;
        activity_rev = rev.activity_rev;
      } catch (e) {
        warnings.push({
          code: 'MSM_REV_ERROR',
          message: `Reversible inhibition calc failed for ${enz.enzyme}: ${(e as Error).message}`,
          severity: 'error',
        });
      }
    }
  }

  // --- TDI ---
  if (enz.useTDI) {
    const kinact = enz.kinact;
    const KI     = enz.KI_tdi;
    const Iu     = enz.Iu_tdi ?? 0;
    const kdeg   = enz.kdeg;

    if (kinact === undefined || KI === undefined) {
      warnings.push({
        code: 'MSM_TDI_MISSING_PARAMS',
        message: `TDI checked for ${enz.enzyme} but kinact or KI is missing; TDI contribution skipped.`,
        severity: 'caution',
      });
    } else {
      try {
        const tdi = computeTDIContribution(kinact, KI, Iu, kdeg);
        lambda       = tdi.lambda;
        R_TDI        = tdi.R_TDI;
        activity_TDI = tdi.activity_TDI;
      } catch (e) {
        warnings.push({
          code: 'MSM_TDI_ERROR',
          message: `TDI calc failed for ${enz.enzyme}: ${(e as Error).message}`,
          severity: 'error',
        });
      }
    }
  }

  // --- Induction ---
  if (enz.useInduction) {
    const Emax = enz.Emax;
    const EC50 = enz.EC50_ind;
    const Iu   = enz.Iu_ind ?? 0;

    if (Emax === undefined || EC50 === undefined) {
      warnings.push({
        code: 'MSM_IND_MISSING_PARAMS',
        message: `Induction checked for ${enz.enzyme} but Emax or EC50 is missing; induction contribution skipped.`,
        severity: 'caution',
      });
    } else {
      try {
        const ind = computeInductionContribution(Emax, EC50, Iu);
        fold_induction = ind.fold_induction;
      } catch (e) {
        warnings.push({
          code: 'MSM_IND_ERROR',
          message: `Induction calc failed for ${enz.enzyme}: ${(e as Error).message}`,
          severity: 'error',
        });
      }
    }
  }

  // --- Net activity ratio ---
  // net_activity = fold_induction / (R_rev × R_TDI)
  // net_activity < 1 → net inhibition (AUCR > 1)
  // net_activity > 1 → net induction (AUCR < 1)
  const net_activity_ratio = fold_induction / (R_rev * R_TDI);

  // --- AUCR ---
  // AUCR = 1 / (fm × net_activity + (1 - fm))
  //
  // Where net_activity = fold_induction / (R_rev × R_TDI) ∈ (0, ∞)
  //   • net_activity < 1: inhibition dominant → denominator < 1 → AUCR > 1 (substrate AUC increases)
  //   • net_activity > 1: induction dominant → denominator > 1 → AUCR < 1 (substrate AUC decreases)
  //   • net_activity = 1: no interaction → AUCR = 1
  //
  // Derived from: substrate AUCR = 1 / [fm × (remaining enzyme fraction) + (1 - fm)]
  // where remaining enzyme fraction = net_activity = fold_induction / (R_rev × R_TDI)
  // Reference: FDA (2020) Drug Interaction Studies Guidance

  const fm = enz.fm;
  let AUCR: number | undefined;

  if (fm > 0) {
    // AUCR = 1 / (fm × net_activity + (1 - fm))
    // net_activity = fold_induction / (R_rev × R_TDI) ∈ (0, ∞)
    //   • net < 1: inhibition dominant → denominator < 1 → AUCR > 1 (substrate AUC increases)
    //   • net > 1: induction dominant → denominator > 1 → AUCR < 1 (substrate AUC decreases)
    // Reference: FDA (2020) Drug Interaction Studies Guidance, Eq. 1-3
    const denominator = fm * net_activity_ratio + (1 - fm);
    // Guard against pathological zero denominator (would require fm=1 and net=0)
    AUCR = denominator > 0 ? 1 / denominator : Infinity;
  } else {
    // fm = 0 → no metabolic contribution → AUCR = 1.0
    AUCR = 1.0;
  }

  const intermediates: MechanisticStaticIntermediate = {
    R_rev:          enz.useReversible ? R_rev : undefined,
    activity_rev:   enz.useReversible ? activity_rev : undefined,
    lambda:         enz.useTDI ? lambda : undefined,
    R_TDI:          enz.useTDI ? R_TDI : undefined,
    activity_TDI:   enz.useTDI ? activity_TDI : undefined,
    fold_induction: enz.useInduction ? fold_induction : undefined,
    net_activity_ratio,
    AUCR,
  };

  const risk  = classifyAUCR(AUCR ?? 1);
  const label = riskLabel(risk);

  return {
    enzyme: enz.enzyme,
    intermediates,
    risk,
    riskLabel: label,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

/**
 * Run the combined mechanistic static model for all configured enzymes.
 *
 * For each enzyme, computes R_rev, R_TDI, fold_induction, net_activity, and
 * AUCR, then classifies the DDI risk.
 *
 * @param inputs  MechanisticStaticInputs
 * @returns       MechanisticStaticResults
 */
export function computeMechanisticStatic(
  inputs: MechanisticStaticInputs,
): MechanisticStaticResults {
  const enzymeResults: MechanisticStaticEnzymeResult[] = [];
  const globalWarnings: Warning[] = [];

  const RISK_ORDER: DDIRiskLevel[] = ['no_risk', 'potential_risk', 'risk', 'high_risk'];

  let overallRisk: DDIRiskLevel = 'no_risk';

  for (const enz of inputs.enzymes) {
    const result = computeEnzymeResult(enz);
    enzymeResults.push(result);

    // Propagate warnings
    globalWarnings.push(...result.warnings.filter(w => w.severity === 'error'));

    // Update overall risk
    const idx = RISK_ORDER.indexOf(result.risk);
    const curIdx = RISK_ORDER.indexOf(overallRisk);
    if (idx > curIdx) overallRisk = result.risk;
  }

  return {
    enzymeResults,
    overallRisk,
    warnings: globalWarnings,
  };
}
