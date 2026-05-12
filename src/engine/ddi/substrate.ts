/**
 * DDI substrate assessment functions.
 *
 * Determines the impact on a substrate's exposure when one of its elimination
 * pathways is completely or partially inhibited.
 *
 * References:
 *   FDA (2020) Drug Interaction Studies — Study Design, Data Analysis, Implications for
 *     Dosing and Labeling Recommendations (Guidance for Industry)
 *   EMA (2012) Guideline on the Investigation of Drug Interactions
 */

import type {
  CYPEnzyme,
  DDIRiskLevel,
  SubstratePathway,
  SubstrateResult,
  Transporter,
} from '@/types';

// ---------------------------------------------------------------------------
// AUCR CALCULATIONS
// ---------------------------------------------------------------------------

/**
 * AUCR with complete inhibition of a single metabolic pathway.
 *
 * When an enzyme responsible for fraction fm is fully inhibited, the remaining
 * clearance is (1 − fm) × CL_total.
 *
 *   AUCR_max = 1 / (1 − fm)
 *
 * @param fm  Fraction of systemic clearance through the inhibited pathway (0–1)
 */
export function AUCR_complete_inhibition(fm: number): number {
  if (fm < 0 || fm > 1)
    throw new Error(`AUCR_complete_inhibition: fm must be in [0,1], got ${fm}`);
  const remaining = 1 - fm;
  if (remaining <= 0) return Infinity; // complete elimination of clearance
  return 1 / remaining;
}

/**
 * AUCR for partial inhibition of a metabolic pathway.
 *
 *   AUCR = 1 / [(1 − fm) + fm / inhibitionFactor]
 *
 * where inhibitionFactor = R1 = 1 + (fu_plasma × Cmax) / Ki
 *
 * @param fm               Fraction of systemic clearance through inhibited pathway
 * @param inhibitionFactor R1 ratio = 1 + Iu / Ki
 */
export function AUCR_partial(fm: number, inhibitionFactor: number): number {
  if (fm < 0 || fm > 1)
    throw new Error(`AUCR_partial: fm must be in [0,1], got ${fm}`);
  if (inhibitionFactor < 1)
    throw new Error(`AUCR_partial: inhibitionFactor (R1) must be ≥ 1, got ${inhibitionFactor}`);
  const remaining = (1 - fm) + fm / inhibitionFactor;
  if (remaining <= 0) return Infinity;
  return 1 / remaining;
}

// ---------------------------------------------------------------------------
// SUBSTRATE CLASSIFICATION
// ---------------------------------------------------------------------------

/**
 * Classify a substrate based on its fraction metabolised (fm).
 *
 * Sensitive substrate:  AUCR_max = 1/(1−fm) ≥ 5  →  fm ≥ 0.80
 * Major substrate:      AUCR_max ≥ 2              →  fm ≥ 0.50
 * Minor substrate:      fm < 0.25
 *
 * @param fm  Fraction of systemic clearance through the assessed pathway
 */
export function classifySubstrate(fm: number): { isSensitive: boolean; isMajor: boolean } {
  if (fm < 0 || fm > 1)
    throw new Error(`classifySubstrate: fm must be in [0,1], got ${fm}`);

  // AUCR_max ≥ 5 ↔ fm ≥ 0.80
  const isSensitive = fm >= 0.80;
  // AUCR_max ≥ 2 ↔ fm ≥ 0.50
  const isMajor     = fm >= 0.50;

  return { isSensitive, isMajor };
}

// ---------------------------------------------------------------------------
// FULL SUBSTRATE PATHWAY ANALYSIS
// ---------------------------------------------------------------------------

/**
 * Assess all substrate pathways and return a SubstrateResult for each.
 *
 * For each pathway:
 *  - Computes AUCR with complete inhibition
 *  - Classifies sensitivity (sensitive ≥ 0.80, major ≥ 0.50, minor < 0.25)
 *  - Assigns a risk level based on AUCR_max thresholds
 *
 * Risk thresholds (FDA/EMA):
 *  - AUCR_max ≥ 5   → high_risk (sensitive substrate)
 *  - AUCR_max ≥ 2   → risk      (major substrate)
 *  - AUCR_max ≥ 1.25 → potential_risk (moderate effect)
 *  - AUCR_max < 1.25 → no_risk
 *
 * @param pathways  Array of SubstratePathway objects
 */
export function assessSubstratePaths(pathways: SubstratePathway[]): SubstrateResult[] {
  return pathways.map(p => {
    const { enzyme, fm } = p;

    let AUCR_max: number;
    let riskLevel: DDIRiskLevel;
    let note: string;

    // Guard: fm should be in [0,1]
    if (fm < 0 || fm > 1) {
      return {
        enzyme,
        fm,
        AUCR_max_inhibition: NaN,
        isSensitive:         false,
        isMajor:             false,
        riskLevel:           'no_risk' as DDIRiskLevel,
        note: `Invalid fm value (${fm}); must be in [0,1].`,
      };
    }

    AUCR_max = AUCR_complete_inhibition(fm);
    const { isSensitive, isMajor } = classifySubstrate(fm);

    if (AUCR_max >= 5 || !isFinite(AUCR_max)) {
      riskLevel = 'high_risk';
      note = `Sensitive substrate (fm=${fm.toFixed(2)}): AUCR_max=${
        isFinite(AUCR_max) ? AUCR_max.toFixed(1) : '∞'
      } — full inhibition could cause ≥5-fold exposure increase.`;
    } else if (AUCR_max >= 2) {
      riskLevel = 'risk';
      note = `Major substrate (fm=${fm.toFixed(2)}): AUCR_max=${AUCR_max.toFixed(1)} — inhibition could cause ≥2-fold exposure increase.`;
    } else if (AUCR_max >= 1.25) {
      riskLevel = 'potential_risk';
      note = `Moderate substrate (fm=${fm.toFixed(2)}): AUCR_max=${AUCR_max.toFixed(1)} — modest exposure increase possible.`;
    } else {
      riskLevel = 'no_risk';
      note = `Minor substrate (fm=${fm.toFixed(2)}): AUCR_max=${AUCR_max.toFixed(1)} — limited impact expected.`;
    }

    return {
      enzyme,
      fm,
      AUCR_max_inhibition: AUCR_max,
      isSensitive,
      isMajor,
      riskLevel,
      note,
    };
  });
}
