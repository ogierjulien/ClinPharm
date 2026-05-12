/**
 * DDI module orchestrator.
 *
 * Runs substrate, reversible inhibition, TDI, induction, and transporter
 * assessments and returns a consolidated DDIResults object including an
 * overall risk level and a risk matrix.
 */

import type {
  DDIInputs,
  DDIPathwayResult,
  DDIResults,
  DDIRiskLevel,
  RiskMatrixEntry,
  Warning,
} from '@/types';

import { assessSubstratePaths }        from './substrate';
import { assessReversibleInhibition, assessTDI } from './inhibition';
import { assessInduction }             from './induction';
import { assessTransporterInhibition } from './transporters';

// ---------------------------------------------------------------------------
// RISK LEVEL ORDERING
// ---------------------------------------------------------------------------

const RISK_ORDER: DDIRiskLevel[] = ['no_risk', 'potential_risk', 'risk', 'high_risk'];

function maxRisk(a: DDIRiskLevel, b: DDIRiskLevel): DDIRiskLevel {
  return RISK_ORDER[Math.max(RISK_ORDER.indexOf(a), RISK_ORDER.indexOf(b))];
}

// ---------------------------------------------------------------------------
// MAIN ORCHESTRATOR
// ---------------------------------------------------------------------------

/**
 * Run all DDI assessments from a single DDIInputs object.
 *
 * Assessments performed:
 *  1. Substrate pathway analysis (AUCR with complete inhibition)
 *  2. Reversible CYP inhibition (R1 ratio, EMA/FDA)
 *  3. Time-dependent inhibition (R2 ratio)
 *  4. CYP induction (Emax model, fold induction + R3)
 *  5. Transporter inhibition (R values vs regulatory thresholds)
 *
 * @param inputs  DDIInputs
 * @returns       DDIResults
 */
export function runDDI(inputs: DDIInputs): DDIResults {
  const globalWarnings: Warning[] = [];

  // --- Validate concentration inputs ---
  const hasConcentration =
    (inputs.Cmax_unbound !== undefined && inputs.Cmax_unbound > 0) ||
    (inputs.Cmax_total   !== undefined && inputs.Cmax_total   > 0);

  if (!hasConcentration && inputs.reversibleInhibitors.length > 0) {
    globalWarnings.push({
      code: 'MISSING_CONCENTRATION',
      message: 'No Cmax_unbound or Cmax_total provided; R1 calculations may be incomplete.',
      severity: 'caution',
    });
  }

  // ---------- 1. Substrate assessment ----------
  let substrateResults = assessSubstratePaths(inputs.substratePathways);

  // ---------- 2. Reversible inhibition ----------
  const reversibleResults = assessReversibleInhibition(
    inputs.reversibleInhibitors,
    1.02,   // EMA threshold
    1.1,    // FDA threshold
  );

  // ---------- 3. TDI ----------
  const tdiResults = assessTDI(inputs.tdiData, 1.25);

  // ---------- 4. Induction ----------
  const inductionResults = assessInduction(inputs.induction, 2);

  // ---------- 5. Transporter inhibition ----------
  const transporterResults = assessTransporterInhibition(inputs.transporterInhibition);

  // ---------- 6. Build risk matrix ----------
  const allResults: DDIResults = {
    substrateResults,
    reversibleInhibitionResults: reversibleResults,
    TDIResults:                  tdiResults,
    inductionResults,
    transporterResults,
    overallRisk:                 'no_risk', // placeholder
    riskMatrix:                  [],        // placeholder
    warnings:                    globalWarnings,
  };

  allResults.riskMatrix  = buildRiskMatrix(allResults);
  allResults.overallRisk = overallRisk(allResults);

  return allResults;
}

// ---------------------------------------------------------------------------
// RISK MATRIX
// ---------------------------------------------------------------------------

/**
 * Build a flat risk matrix from all DDI assessment results.
 *
 * Each entry in the matrix corresponds to a single pathway/mechanism
 * and its risk level.
 */
export function buildRiskMatrix(results: DDIResults): RiskMatrixEntry[] {
  const matrix: RiskMatrixEntry[] = [];

  // Substrate results
  for (const sub of results.substrateResults) {
    matrix.push({
      pathway:   String(sub.enzyme),
      type:      'substrate',
      risk:      sub.riskLevel,
      metric:    sub.AUCR_max_inhibition,
      threshold: 5, // sensitive substrate threshold
    });
  }

  // Reversible inhibition
  for (const rev of results.reversibleInhibitionResults) {
    matrix.push({
      pathway:   rev.pathway,
      type:      'reversible',
      risk:      rev.risk,
      metric:    rev.metric_value,
      threshold: rev.threshold,
    });
  }

  // TDI
  for (const tdi of results.TDIResults) {
    matrix.push({
      pathway:   tdi.pathway,
      type:      'TDI',
      risk:      tdi.risk,
      metric:    tdi.metric_value,
      threshold: tdi.threshold,
    });
  }

  // Induction
  for (const ind of results.inductionResults) {
    matrix.push({
      pathway:   ind.pathway,
      type:      'induction',
      risk:      ind.risk,
      metric:    ind.metric_value,
      threshold: ind.threshold,
    });
  }

  // Transporter
  for (const tr of results.transporterResults) {
    matrix.push({
      pathway:   tr.pathway,
      type:      'transporter',
      risk:      tr.risk,
      metric:    tr.metric_value,
      threshold: tr.threshold,
    });
  }

  return matrix;
}

// ---------------------------------------------------------------------------
// OVERALL RISK
// ---------------------------------------------------------------------------

/**
 * Determine the overall DDI risk level as the most severe risk across all
 * assessed pathways.
 */
export function overallRisk(results: DDIResults): DDIRiskLevel {
  let worst: DDIRiskLevel = 'no_risk';

  for (const sub of results.substrateResults) {
    worst = maxRisk(worst, sub.riskLevel);
  }
  for (const rev of results.reversibleInhibitionResults) {
    worst = maxRisk(worst, rev.risk);
  }
  for (const tdi of results.TDIResults) {
    worst = maxRisk(worst, tdi.risk);
  }
  for (const ind of results.inductionResults) {
    worst = maxRisk(worst, ind.risk);
  }
  for (const tr of results.transporterResults) {
    worst = maxRisk(worst, tr.risk);
  }

  return worst;
}
