/**
 * Allometry input validation and outlier detection utilities.
 */

import type { AllometryInputs, AnimalDataPoint, Warning } from '@/types';
import type { RegressionResult } from '@/types';

// ---------------------------------------------------------------------------
// INPUT VALIDATION
// ---------------------------------------------------------------------------

/**
 * Validate allometry inputs and return an array of warnings/errors.
 *
 * Checks performed:
 *  - Minimum number of included species (≥ 2 for any fit, ≥ 3 recommended)
 *  - Negative or zero body weight, CL, or Vss values
 *  - Missing fup for methods that require it
 *  - Missing brain weight for brain_weight / caldwell_tang_2
 *  - Missing MLP for MLP / caldwell_tang_1
 *  - Extreme body weight range extrapolation to humans (>100× largest animal)
 *  - Duplicate species
 */
export function validateAllometryInputs(inputs: AllometryInputs): Warning[] {
  const warnings: Warning[] = [];
  const { animalData, methodsSelected, humanBodyWeight_kg } = inputs;

  const included = animalData.filter(d => d.include);

  // --- Minimum species ---
  if (included.length < 2) {
    warnings.push({
      code: 'TOO_FEW_SPECIES',
      message: `Only ${included.length} species are included. At least 2 are required for any regression; ≥ 3 is strongly recommended.`,
      severity: included.length < 2 ? 'error' : 'caution',
      field: 'animalData',
    });
  } else if (included.length < 3) {
    warnings.push({
      code: 'FEW_SPECIES',
      message: 'Only 2 species included. At least 3 species are recommended for reliable allometric scaling.',
      severity: 'caution',
      field: 'animalData',
    });
  }

  // --- Non-positive values ---
  for (const d of included) {
    if (d.bodyWeight_kg <= 0) {
      warnings.push({
        code: 'NONPOSITIVE_BW',
        message: `Species "${d.label}": body weight must be positive (got ${d.bodyWeight_kg} kg).`,
        severity: 'error',
        field: `animalData.${d.id}`,
      });
    }
    const cl = d.CL_abs ?? d.CL_observed;
    if (cl <= 0) {
      warnings.push({
        code: 'NONPOSITIVE_CL',
        message: `Species "${d.label}": CL must be positive (got ${cl}).`,
        severity: 'error',
        field: `animalData.${d.id}`,
      });
    }
    const vss = d.Vss_abs ?? d.Vss_observed;
    if (vss <= 0) {
      warnings.push({
        code: 'NONPOSITIVE_VSS',
        message: `Species "${d.label}": Vss must be positive (got ${vss}).`,
        severity: 'error',
        field: `animalData.${d.id}`,
      });
    }
    if (d.fup !== undefined && (d.fup < 0 || d.fup > 1)) {
      warnings.push({
        code: 'INVALID_FUP',
        message: `Species "${d.label}": fup must be between 0 and 1 (got ${d.fup}).`,
        severity: 'error',
        field: `animalData.${d.id}`,
      });
    }
  }

  // --- Methods requiring fup ---
  const fupMethods: string[] = ['unbound_fraction', 'caldwell_tang_1', 'caldwell_tang_2'];
  if (methodsSelected.some(m => fupMethods.includes(m))) {
    if (inputs.humanFup === undefined || inputs.humanFup <= 0 || inputs.humanFup > 1) {
      warnings.push({
        code: 'MISSING_HUMAN_FUP',
        message: 'Human fup is required for unbound fraction / Caldwell–Tang methods but is missing or invalid.',
        severity: 'error',
        field: 'humanFup',
      });
    }
    const missingFup = included.filter(d => d.fup === undefined || d.fup <= 0);
    if (missingFup.length > 0) {
      warnings.push({
        code: 'MISSING_ANIMAL_FUP',
        message: `${missingFup.length} species missing fup: ${missingFup.map(d => d.label).join(', ')}.`,
        severity: 'warning',
        field: 'animalData',
      });
    }
  }

  // --- Methods requiring brain weight ---
  const brainMethods: string[] = ['brain_weight', 'caldwell_tang_2'];
  if (methodsSelected.some(m => brainMethods.includes(m))) {
    if (inputs.humanBrainWeight_g === undefined || inputs.humanBrainWeight_g <= 0) {
      warnings.push({
        code: 'MISSING_HUMAN_BRAIN_WEIGHT',
        message: 'Human brain weight is required for brain weight / Caldwell–Tang 2 methods.',
        severity: 'warning',
        field: 'humanBrainWeight_g',
      });
    }
    const missingBrW = included.filter(d => d.brainWeight_g === undefined || d.brainWeight_g <= 0);
    if (missingBrW.length > 0) {
      warnings.push({
        code: 'MISSING_ANIMAL_BRAIN_WEIGHT',
        message: `${missingBrW.length} species missing brain weight: ${missingBrW.map(d => d.label).join(', ')}.`,
        severity: 'warning',
        field: 'animalData',
      });
    }
  }

  // --- Methods requiring MLP ---
  const mlpMethods: string[] = ['MLP', 'caldwell_tang_1'];
  if (methodsSelected.some(m => mlpMethods.includes(m))) {
    if (inputs.humanMLP_years === undefined || inputs.humanMLP_years <= 0) {
      warnings.push({
        code: 'MISSING_HUMAN_MLP',
        message: 'Human MLP is required for MLP / Caldwell–Tang 1 methods.',
        severity: 'warning',
        field: 'humanMLP_years',
      });
    }
    const missingMLP = included.filter(d => d.MLP_years === undefined || d.MLP_years <= 0);
    if (missingMLP.length > 0) {
      warnings.push({
        code: 'MISSING_ANIMAL_MLP',
        message: `${missingMLP.length} species missing MLP: ${missingMLP.map(d => d.label).join(', ')}.`,
        severity: 'warning',
        field: 'animalData',
      });
    }
  }

  // --- Body weight extrapolation ---
  if (included.length > 0 && humanBodyWeight_kg > 0) {
    const maxAnimalBW = Math.max(...included.map(d => d.bodyWeight_kg));
    const minAnimalBW = Math.min(...included.map(d => d.bodyWeight_kg));
    if (humanBodyWeight_kg > maxAnimalBW * 100) {
      warnings.push({
        code: 'EXTREME_EXTRAPOLATION',
        message: `Human BW (${humanBodyWeight_kg} kg) is > 100× the largest animal BW (${maxAnimalBW} kg). Extrapolation may be unreliable.`,
        severity: 'warning',
        field: 'humanBodyWeight_kg',
      });
    }
    if (humanBodyWeight_kg < minAnimalBW) {
      warnings.push({
        code: 'HUMAN_BW_BELOW_ANIMAL',
        message: `Human BW (${humanBodyWeight_kg} kg) is below the smallest animal BW (${minAnimalBW} kg). Interpolating rather than extrapolating.`,
        severity: 'info',
        field: 'humanBodyWeight_kg',
      });
    }
  }

  // --- Duplicate species check ---
  const speciesCounts: Record<string, number> = {};
  for (const d of included) {
    speciesCounts[d.species] = (speciesCounts[d.species] ?? 0) + 1;
  }
  for (const [sp, count] of Object.entries(speciesCounts)) {
    if (count > 1) {
      warnings.push({
        code: 'DUPLICATE_SPECIES',
        message: `Species "${sp}" appears ${count} times. Duplicate entries may bias the regression.`,
        severity: 'caution',
        field: 'animalData',
      });
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// OUTLIER DETECTION
// ---------------------------------------------------------------------------

/**
 * Detect potential outliers using studentized (internally studentized) residuals
 * and leverage (hat matrix diagonal) from the log-log regression.
 *
 * An observation is flagged as a potential outlier if:
 *   |studentized residual| > 2.5  OR  leverage > 2(p+1)/n
 *
 * @param reg          Fitted regression result
 * @param bodyWeights  Original body weights (kg) corresponding to reg
 * @returns            Array of indices (0-based) of potential outliers
 */
export function detectOutliers(reg: RegressionResult, bodyWeights: number[]): number[] {
  const n = reg.n;
  if (n < 3) return []; // Need at least 3 points for meaningful outlier detection

  const validBWs: number[] = [];
  const validIdx: number[] = [];
  bodyWeights.forEach((bw, i) => {
    if (bw > 0 && isFinite(reg.residuals[i])) {
      validBWs.push(Math.log(bw));
      validIdx.push(i);
    }
  });

  const m = validBWs.length;
  if (m < 3) return [];

  const xBar = validBWs.reduce((s, v) => s + v, 0) / m;
  const Sxx  = validBWs.reduce((s, v) => s + (v - xBar) ** 2, 0);

  // Leverage: h_i = 1/n + (xi - x̄)² / Sxx
  const leverages = validBWs.map(xi => 1 / m + (xi - xBar) ** 2 / Sxx);

  // Internally studentized residuals: r_i = e_i / (s × sqrt(1 - h_i))
  const SSres = validIdx.reduce((s, origIdx) => s + reg.residuals[origIdx] ** 2, 0);
  const MSE   = SSres / (m - 2);
  const s     = Math.sqrt(MSE);

  const outlierIndices: number[] = [];
  const leverageThreshold = 2 * 2 / m; // 2(p+1)/n where p=1 (slope only)

  validIdx.forEach((origIdx, j) => {
    const hi = leverages[j];
    const denom = s * Math.sqrt(Math.max(0, 1 - hi));
    const studentized = denom > 0 ? Math.abs(reg.residuals[origIdx] / denom) : 0;

    if (studentized > 2.5 || hi > leverageThreshold) {
      outlierIndices.push(origIdx);
    }
  });

  return outlierIndices;
}

// ---------------------------------------------------------------------------
// RODENT-ONLY CHECK
// ---------------------------------------------------------------------------

/** Returns true if all data points belong to rodent species. */
export function isRodentOnly(data: AnimalDataPoint[]): boolean {
  if (data.length === 0) return false;
  const rodents = new Set(['mouse', 'rat', 'guinea_pig', 'hamster']);
  return data.every(d => rodents.has(d.species));
}
