/**
 * DDI transporter inhibition assessment.
 *
 * Implements regulatory R-value calculations and thresholds for clinically
 * relevant drug transporters per FDA (2020) and EMA (2012) guidance.
 *
 * Transporters assessed:
 *   P-gp (MDR1), BCRP, OATP1B1, OATP1B3, OAT1, OAT3, OCT2, MATE1, MATE2-K
 */

import type {
  DDIPathwayResult,
  DDIRiskLevel,
  Transporter,
  TransporterInhibitionData,
  Warning,
} from '@/types';

// ---------------------------------------------------------------------------
// TRANSPORTER THRESHOLDS
// ---------------------------------------------------------------------------

export interface TransporterThreshold {
  metric: string;             // 'R_gut', 'R_systemic', 'R_inlet'
  threshold: number;          // numeric threshold for R value
  regulatorySource: string;
  useGutConcentration: boolean;
}

/**
 * Regulatory thresholds for transporter inhibition R values.
 *
 * P-gp intestinal:  R = 1 + Igut / IC50 ≥ 10 → investigate
 * P-gp systemic:    Cmax_unbound / IC50 ≥ 0.1 → investigate
 * BCRP intestinal:  R = 1 + Igut / IC50 ≥ 10 → investigate
 * BCRP systemic:    Cmax_unbound / IC50 ≥ 0.1 → investigate
 * OATP1B1/1B3:      Iu_inlet / IC50 ≥ 0.1 → investigate
 * OAT1, OAT3:       Cmax_unbound / IC50 ≥ 0.1 → investigate
 * OCT2:             Cmax_unbound / IC50 ≥ 0.02 → investigate
 * MATE1, MATE2-K:   Cmax_unbound / IC50 ≥ 0.02 → investigate
 */
export const TRANSPORTER_THRESHOLDS: Record<Transporter, TransporterThreshold> = {
  'P-gp': {
    metric:              'R_gut = 1 + Igut / IC50',
    threshold:           10,
    regulatorySource:    'FDA (2020) Guidance; EMA (2012) Guideline',
    useGutConcentration: true,
  },
  'BCRP': {
    metric:              'R_gut = 1 + Igut / IC50',
    threshold:           10,
    regulatorySource:    'FDA (2020) Guidance; EMA (2012) Guideline',
    useGutConcentration: true,
  },
  'OATP1B1': {
    metric:              'R_inlet = Iu_inlet / IC50',
    threshold:           0.1,
    regulatorySource:    'FDA (2020) Guidance; EMA (2012) Guideline',
    useGutConcentration: false,
  },
  'OATP1B3': {
    metric:              'R_inlet = Iu_inlet / IC50',
    threshold:           0.1,
    regulatorySource:    'FDA (2020) Guidance; EMA (2012) Guideline',
    useGutConcentration: false,
  },
  'OAT1': {
    metric:              'R_sys = Cmax_unbound / IC50',
    threshold:           0.1,
    regulatorySource:    'FDA (2020) Guidance',
    useGutConcentration: false,
  },
  'OAT3': {
    metric:              'R_sys = Cmax_unbound / IC50',
    threshold:           0.1,
    regulatorySource:    'FDA (2020) Guidance',
    useGutConcentration: false,
  },
  'OCT2': {
    metric:              'R_sys = Cmax_unbound / IC50',
    threshold:           0.02,
    regulatorySource:    'FDA (2020) Guidance',
    useGutConcentration: false,
  },
  'MATE1': {
    metric:              'R_sys = Cmax_unbound / IC50',
    threshold:           0.02,
    regulatorySource:    'FDA (2020) Guidance',
    useGutConcentration: false,
  },
  'MATE2K': {
    metric:              'R_sys = Cmax_unbound / IC50',
    threshold:           0.02,
    regulatorySource:    'FDA (2020) Guidance',
    useGutConcentration: false,
  },
};

// ---------------------------------------------------------------------------
// GENERIC TRANSPORTER R VALUE
// ---------------------------------------------------------------------------

/**
 * Compute the generic transporter R value.
 *
 * R = 1 + I / IC50
 *
 * For intestinal transporters (P-gp, BCRP): use I = Igut
 * For systemic transporters: use I = Cmax_unbound (systemic)
 * For OATP1B1/1B3 (hepatic inlet): use I = Iu_inlet
 *
 * Note: for the simple Cmax/IC50 ratio (OATP inlet), the formula is just
 * R = I / IC50 without the "+1" term. Both are supported here via the
 * additive parameter.
 *
 * @param I      Inhibitor concentration at relevant site (µM)
 * @param IC50   IC50 for transporter inhibition (µM)
 */
export function transporterR(I: number, IC50: number): number {
  if (IC50 <= 0) throw new Error(`transporterR: IC50 must be positive, got ${IC50}`);
  return 1 + I / IC50;
}

/**
 * Simple ratio (without +1) used for OATP1B1/1B3 and OAT assessments.
 *
 * R_ratio = I / IC50
 */
export function transporterRatio(I: number, IC50: number): number {
  if (IC50 <= 0) throw new Error(`transporterRatio: IC50 must be positive, got ${IC50}`);
  return I / IC50;
}

// ---------------------------------------------------------------------------
// FULL TRANSPORTER INHIBITION ASSESSMENT
// ---------------------------------------------------------------------------

/**
 * Assess transporter inhibition potential for all provided transporter data.
 *
 * For each transporter:
 *  - Computes the appropriate R metric based on regulatory guidance
 *  - Compares to the relevant threshold
 *  - Returns a DDIPathwayResult
 *
 * @param data  Array of TransporterInhibitionData
 */
export function assessTransporterInhibition(
  data: TransporterInhibitionData[],
): DDIPathwayResult[] {
  const results: DDIPathwayResult[] = [];

  for (const entry of data) {
    const warnings: Warning[] = [];
    const { transporter, IC50, Ki, Iu_gut, Iu_systemic, threshold_R, threshold_concentration } = entry;

    // Determine IC50 to use (prefer Ki if provided for consistency with inhibition module)
    const ic50 = IC50 ?? Ki;
    if (ic50 === undefined || ic50 <= 0) {
      warnings.push({
        code: 'MISSING_IC50',
        message: `No IC50 or Ki provided for ${transporter}; cannot compute R value.`,
        severity: 'error',
      });
      results.push({
        pathway:      transporter,
        metric_name:  'R',
        metric_value: NaN,
        threshold:    threshold_R ?? NaN,
        risk:         'no_risk',
        rationale:    `Missing IC50/Ki for ${transporter}`,
        equation:     'R = 1 + I / IC50',
        confidence:   'low',
        warnings,
      });
      continue;
    }

    const cfg = TRANSPORTER_THRESHOLDS[transporter];
    if (!cfg) {
      warnings.push({
        code: 'UNKNOWN_TRANSPORTER',
        message: `No regulatory threshold config found for transporter "${transporter}".`,
        severity: 'warning',
      });
    }

    const regulatoryThreshold = threshold_R ?? cfg?.threshold ?? 0.1;
    const isIntestinal = cfg?.useGutConcentration ?? false;

    let R: number;
    let metricName: string;
    let equationStr: string;
    let I: number;

    if (isIntestinal) {
      // P-gp, BCRP: use gut lumen concentration
      // Igut is typically calculated as: dose_mg × 1000 / 250 mL × (1/MW) µM
      // but here we accept Iu_gut directly
      if (Iu_gut === undefined) {
        warnings.push({
          code: 'MISSING_IGUT',
          message: `Intestinal transporter ${transporter} requires Iu_gut (gut lumen concentration).`,
          severity: 'caution',
        });
        I = Iu_systemic ?? 0;
      } else {
        I = Iu_gut;
      }
      R = transporterR(I, ic50);
      metricName = `R = 1 + Igut / IC50`;
      equationStr = `R = 1 + Igut / IC50 = 1 + ${I.toExponential(3)} / ${ic50} = ${R.toFixed(3)}`;
    } else if (transporter === 'OATP1B1' || transporter === 'OATP1B3') {
      // Hepatic inlet concentration ratio
      const Iu_in = (Iu_systemic ?? Iu_gut ?? 0);
      I = Iu_in;
      R = transporterRatio(I, ic50);  // just I/IC50 for OATP
      metricName = `Iu_inlet / IC50`;
      equationStr = `R = Iu_inlet / IC50 = ${I.toExponential(3)} / ${ic50} = ${R.toFixed(4)}`;

      if (I === 0) {
        warnings.push({
          code: 'MISSING_IU_INLET',
          message: `OATP inhibition assessment requires hepatic inlet Iu (Iu_systemic or Iu_gut).`,
          severity: 'caution',
        });
      }
    } else {
      // OAT1/3, OCT2, MATE1/2K: systemic Cmax_unbound / IC50
      I = Iu_systemic ?? 0;
      R = transporterRatio(I, ic50);
      metricName = `Cmax_unbound / IC50`;
      equationStr = `R = Cmax_unbound / IC50 = ${I.toExponential(3)} / ${ic50} = ${R.toFixed(4)}`;

      if (I === 0) {
        warnings.push({
          code: 'MISSING_IU_SYSTEMIC',
          message: `${transporter} inhibition assessment requires Iu_systemic (unbound systemic Cmax).`,
          severity: 'caution',
        });
      }
    }

    // Determine risk
    let risk: DDIRiskLevel;
    if (isNaN(R)) {
      risk = 'no_risk';
    } else if (R >= regulatoryThreshold * 5) {
      risk = 'high_risk';
    } else if (R >= regulatoryThreshold) {
      risk = 'risk';
    } else if (R >= regulatoryThreshold * 0.5) {
      risk = 'potential_risk';
    } else {
      risk = 'no_risk';
    }

    results.push({
      pathway:      transporter,
      metric_name:  metricName,
      metric_value: R,
      threshold:    regulatoryThreshold,
      risk,
      rationale: `${equationStr}. Threshold = ${regulatoryThreshold}. ` +
        `Source: ${cfg?.regulatorySource ?? 'FDA/EMA guidance'}.`,
      equation:     equationStr,
      confidence:   IC50 !== undefined ? 'high' : 'medium',
      warnings,
    });
  }

  return results;
}
