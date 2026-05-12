/**
 * Allometry module orchestrator.
 *
 * Runs all selected allometric scaling methods and returns consolidated results
 * including method-level predictions, back-predictions, AAFE, and a method
 * ranking table.
 */

import type {
  AllometryInputs,
  AllometryResults,
  AllometrySingleMethodResult,
  AnimalDataPoint,
  MethodRankEntry,
  Warning,
} from '@/types';

import { validateAllometryInputs } from './validation';
import {
  simpleAllometry,
  unboundFractionAllometry,
  brainWeightAllometry,
  MLPAllometry,
  ruleOfExponent,
  liverBloodFlowAllometry,
  speciesInvariantTime,
  fixedExponentAllometry,
  twoSpeciesSensitivity,
  threeSpeciesSensitivity,
  monkeyOnlyScaling,
  leaveOneOut,
  caldwellTang1,
  caldwellTang2,
  caldwellTang3,
} from './methods';
import { fitRobustRegression, predictFromRegression, computeAAFE } from './regression';

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

/** Normalise CL/Vss to absolute values in-place. */
function normaliseData(data: AnimalDataPoint[]): AnimalDataPoint[] {
  return data.map(d => {
    const clAbs  = d.CL_perKg_input  ? d.CL_observed  * d.bodyWeight_kg : d.CL_observed;
    const vssAbs = d.Vss_perKg_input ? d.Vss_observed * d.bodyWeight_kg : d.Vss_observed;
    return { ...d, CL_abs: clAbs, Vss_abs: vssAbs };
  });
}

// Default physiology constants used for liver blood flow
const HUMAN_QH_ML_MIN = 1500;
const DEFAULT_HUMAN_BRAIN_WEIGHT_G = 1400;
const DEFAULT_HUMAN_MLP_YEARS      = 122;

// ---------------------------------------------------------------------------
// MAIN ORCHESTRATOR
// ---------------------------------------------------------------------------

/**
 * Run all selected allometry methods and return consolidated results.
 *
 * @param inputs  AllometryInputs
 * @returns       AllometryResults
 */
export function runAllometry(inputs: AllometryInputs): AllometryResults {
  // 1. Validate inputs
  const validationWarnings = validateAllometryInputs(inputs);
  const globalWarnings: Warning[] = [...validationWarnings];

  // 2. Filter to included species and normalise
  const rawData = inputs.animalData.filter(d => d.include);
  if (rawData.length === 0) {
    return {
      methodResults: [],
      methodRanking: [],
      warnings: [
        ...globalWarnings,
        { code: 'NO_DATA', message: 'No animal data points are included.', severity: 'error' },
      ],
    };
  }
  const data = normaliseData(rawData);

  const {
    humanBodyWeight_kg: humanBW,
    humanFup,
    humanBrainWeight_g,
    humanMLP_years,
    methodsSelected,
  } = inputs;

  const bwHuman   = humanBW;
  const fup       = humanFup;
  const brainW    = humanBrainWeight_g ?? DEFAULT_HUMAN_BRAIN_WEIGHT_G;
  const mlp       = humanMLP_years     ?? DEFAULT_HUMAN_MLP_YEARS;

  const methodResults: AllometrySingleMethodResult[] = [];

  // 3. Run each selected method
  for (const method of methodsSelected) {
    try {
      switch (method) {
        case 'simple':
          methodResults.push(simpleAllometry(data, bwHuman));
          break;

        case 'unbound_fraction':
          if (fup !== undefined && fup > 0) {
            methodResults.push(unboundFractionAllometry(data, bwHuman, fup));
          } else {
            methodResults.push({
              method: 'unbound_fraction',
              label: 'Unbound Fraction Correction',
              backPredictions: [],
              warnings: [{ code: 'MISSING_FUP', message: 'Human fup required for unbound fraction method.', severity: 'error' }],
            });
          }
          break;

        case 'brain_weight':
          methodResults.push(brainWeightAllometry(data, bwHuman, brainW));
          break;

        case 'MLP':
          methodResults.push(MLPAllometry(data, bwHuman, mlp));
          break;

        case 'rule_of_exponent':
          methodResults.push(ruleOfExponent(data, bwHuman, fup, mlp, brainW));
          break;

        case 'liver_blood_flow':
          methodResults.push(liverBloodFlowAllometry(data, bwHuman, HUMAN_QH_ML_MIN));
          break;

        case 'species_invariant_time':
          methodResults.push(speciesInvariantTime(data, bwHuman));
          break;

        case 'fixed_exponent_0_75':
          methodResults.push(fixedExponentAllometry(data, bwHuman, 0.75, 'fixed_exponent_0_75'));
          break;

        case 'fixed_exponent_0_85':
          methodResults.push(fixedExponentAllometry(data, bwHuman, 0.85, 'fixed_exponent_0_85'));
          break;

        case 'fixed_exponent_1_0':
          methodResults.push(fixedExponentAllometry(data, bwHuman, 1.0, 'fixed_exponent_1_0'));
          break;

        case 'robust_regression': {
          const BWs  = data.map(d => d.bodyWeight_kg);
          const CLs  = data.map(d => d.CL_abs ?? d.CL_observed);
          const Vsss = data.map(d => d.Vss_abs ?? d.Vss_observed);
          const regCL  = fitRobustRegression(BWs, CLs);
          const regVss = fitRobustRegression(BWs, Vsss);
          const predCL  = predictFromRegression(regCL,  bwHuman);
          const predVss = predictFromRegression(regVss, bwHuman);
          const clPreds  = data.map(d => predictFromRegression(regCL,  d.bodyWeight_kg));
          const vssPreds = data.map(d => predictFromRegression(regVss, d.bodyWeight_kg));
          methodResults.push({
            method:             'robust_regression',
            label:              'Robust Regression (Huber)',
            regressionCL:       regCL,
            regressionVss:      regVss,
            predictedCL_human:  predCL,
            predictedVss_human: predVss,
            backPredictions: data.map((d, i) => ({
              species:       d.species,
              label:         d.label,
              bodyWeight_kg: d.bodyWeight_kg,
              CL_observed:   CLs[i],
              CL_predicted:  clPreds[i],
              Vss_observed:  Vsss[i],
              Vss_predicted: vssPreds[i],
            })),
            AAFE_CL:  computeAAFE(clPreds,  CLs),
            AAFE_Vss: computeAAFE(vssPreds, Vsss),
            warnings: [],
          });
          break;
        }

        case 'two_species':
          methodResults.push(twoSpeciesSensitivity(data, bwHuman));
          break;

        case 'three_species':
          methodResults.push(threeSpeciesSensitivity(data, bwHuman));
          break;

        case 'monkey_only':
          methodResults.push(monkeyOnlyScaling(data, bwHuman));
          break;

        case 'leave_one_out':
          methodResults.push(leaveOneOut(data, bwHuman));
          break;

        case 'caldwell_tang_1':
          if (fup !== undefined && fup > 0) {
            methodResults.push(caldwellTang1(data, bwHuman, fup, mlp));
          } else {
            methodResults.push({
              method: 'caldwell_tang_1',
              label: 'Caldwell–Tang Variant 1',
              backPredictions: [],
              warnings: [{ code: 'MISSING_FUP', message: 'Human fup required for Caldwell–Tang 1.', severity: 'error' }],
            });
          }
          break;

        case 'caldwell_tang_2':
          if (fup !== undefined && fup > 0) {
            methodResults.push(caldwellTang2(data, bwHuman, fup, brainW));
          } else {
            methodResults.push({
              method: 'caldwell_tang_2',
              label: 'Caldwell–Tang Variant 2',
              backPredictions: [],
              warnings: [{ code: 'MISSING_FUP', message: 'Human fup required for Caldwell–Tang 2.', severity: 'error' }],
            });
          }
          break;

        case 'caldwell_tang_3':
          methodResults.push(caldwellTang3(data, bwHuman));
          break;

        default:
          globalWarnings.push({
            code: 'UNKNOWN_METHOD',
            message: `Unknown allometry method "${method}" skipped.`,
            severity: 'warning',
          });
      }
    } catch (err) {
      globalWarnings.push({
        code: 'METHOD_FAILED',
        message: `Method "${method}" failed: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'error',
      });
    }
  }

  // 4. Rank methods
  const methodRanking = rankMethods(methodResults);

  return {
    methodResults,
    methodRanking,
    warnings: globalWarnings,
  };
}

// ---------------------------------------------------------------------------
// METHOD RANKING
// ---------------------------------------------------------------------------

/**
 * Rank allometry methods by AAFE (average absolute fold error) across back-predictions.
 * Lower AAFE = better rank. Methods without AAFE are sorted to the end.
 */
export function rankMethods(results: AllometrySingleMethodResult[]): MethodRankEntry[] {
  // Build table entries
  const entries: MethodRankEntry[] = results.map(r => ({
    method:       r.method,
    label:        r.label,
    predictedCL:  r.predictedCL_human,
    predictedVss: r.predictedVss_human,
    AAFE_CL:      r.AAFE_CL,
    AAFE_Vss:     r.AAFE_Vss,
    notes:        r.warnings.map(w => w.message).join(' | ') || undefined,
  }));

  // Sort by AAFE_CL ascending (undefined last)
  const sortedCL = [...entries].sort((a, b) => {
    if (a.AAFE_CL === undefined && b.AAFE_CL === undefined) return 0;
    if (a.AAFE_CL === undefined) return 1;
    if (b.AAFE_CL === undefined) return -1;
    return a.AAFE_CL - b.AAFE_CL;
  });
  sortedCL.forEach((e, i) => { e.rank_CL = i + 1; });

  // Sort by AAFE_Vss ascending
  const sortedVss = [...entries].sort((a, b) => {
    if (a.AAFE_Vss === undefined && b.AAFE_Vss === undefined) return 0;
    if (a.AAFE_Vss === undefined) return 1;
    if (b.AAFE_Vss === undefined) return -1;
    return a.AAFE_Vss - b.AAFE_Vss;
  });
  sortedVss.forEach((e, i) => { e.rank_Vss = i + 1; });

  // Merge ranks back into entries (entries array already mutated in place via ref)
  return entries;
}
