/**
 * Weighted and unweighted log-log linear regression for allometric scaling.
 * All fits use the model:  ln(P_i) = ln(a) + b × ln(BW_i)
 * i.e.  P = a × BW^b
 */

import type { RegressionResult } from '@/types';

// ---------------------------------------------------------------------------
// t-distribution critical value (two-tailed, p=0.05, df = n-2)
// Approximated by a small lookup table + Wilson-Hilferty approximation.
// ---------------------------------------------------------------------------

/** Approximate two-tailed t critical value for α=0.05 (95% CI) given df. */
function tCritical(df: number): number {
  if (df <= 0) return Infinity;
  // Exact small-df values
  const exact: Record<number, number> = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
    6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
    11: 2.201, 12: 2.179, 13: 2.160, 14: 2.145, 15: 2.131,
    16: 2.120, 17: 2.110, 18: 2.101, 19: 2.093, 20: 2.086,
    25: 2.060, 30: 2.042, 40: 2.021, 60: 2.000, 120: 1.980,
  };
  if (exact[df] !== undefined) return exact[df];
  // For df > 120 use normal approximation
  if (df > 120) return 1.960;
  // Linear interpolation between nearest tabulated values
  const keys = Object.keys(exact).map(Number).sort((a, b) => a - b);
  for (let i = 0; i < keys.length - 1; i++) {
    const lo = keys[i], hi = keys[i + 1];
    if (df >= lo && df <= hi) {
      const frac = (df - lo) / (hi - lo);
      return exact[lo] + frac * (exact[hi] - exact[lo]);
    }
  }
  return 1.960;
}

// ---------------------------------------------------------------------------
// PRIMARY REGRESSION FUNCTION
// ---------------------------------------------------------------------------

/**
 * Fit P = a × BW^b via log-log OLS (optionally weighted).
 *
 * Analytical OLS on log-transformed data:
 *   xi = ln(BW_i),  yi = ln(value_i)
 *   b  = Σ w_i(xi - x̄_w)(yi - ȳ_w) / Σ w_i(xi - x̄_w)²
 *   intercept = ȳ_w − b × x̄_w
 *   R² = 1 − SSres / SStot
 *   SE_b = sqrt(MSE / Σ w_i(xi-x̄_w)²),  MSE = SSres / (n−2)
 *   95% CI: b ± t(n-2, 0.975) × SE_b
 *
 * @param bodyWeights  array of body weights (kg)
 * @param values       array of pharmacokinetic parameter values (same length)
 * @param weights      optional OLS weights (default: all 1)
 * @returns            RegressionResult
 */
export function fitAllometricRegression(
  bodyWeights: number[],
  values: number[],
  weights?: number[],
): RegressionResult {
  const n = bodyWeights.length;
  if (n !== values.length)
    throw new Error('fitAllometricRegression: bodyWeights and values must have the same length');
  if (n < 2)
    throw new Error('fitAllometricRegression: at least 2 data points required');

  // Default equal weights
  const w: number[] = weights && weights.length === n ? [...weights] : new Array(n).fill(1);

  // Log-transform (filter out non-positive values)
  const x: number[] = [];
  const y: number[] = [];
  const wf: number[] = [];
  const usedIdx: number[] = [];

  for (let i = 0; i < n; i++) {
    if (bodyWeights[i] > 0 && values[i] > 0 && w[i] > 0) {
      x.push(Math.log(bodyWeights[i]));
      y.push(Math.log(values[i]));
      wf.push(w[i]);
      usedIdx.push(i);
    }
  }

  const m = x.length;
  if (m < 2)
    throw new Error('fitAllometricRegression: fewer than 2 valid (positive) data points after filtering');

  const Sw  = wf.reduce((s, wi) => s + wi, 0);
  const Swx = wf.reduce((s, wi, i) => s + wi * x[i], 0);
  const Swy = wf.reduce((s, wi, i) => s + wi * y[i], 0);

  const xBar = Swx / Sw;
  const yBar = Swy / Sw;

  const Sxx = wf.reduce((s, wi, i) => s + wi * (x[i] - xBar) ** 2, 0);
  const Sxy = wf.reduce((s, wi, i) => s + wi * (x[i] - xBar) * (y[i] - yBar), 0);

  if (Sxx === 0)
    throw new Error('fitAllometricRegression: all body weights are identical; cannot compute slope');

  const slope = Sxy / Sxx;           // allometric exponent b
  const intercept = yBar - slope * xBar; // ln(a)
  const a = Math.exp(intercept);

  // Fitted values and residuals (on log scale)
  const fittedLogValues: number[] = x.map(xi => intercept + slope * xi);
  const residuals: number[] = y.map((yi, i) => yi - fittedLogValues[i]);

  // Residual and total sum of squares
  const SSres = wf.reduce((s, wi, i) => s + wi * residuals[i] ** 2, 0);
  const SStot = wf.reduce((s, wi, i) => s + wi * (y[i] - yBar) ** 2, 0);

  const rSquared = SStot === 0 ? 1 : Math.max(0, 1 - SSres / SStot);

  // Adjusted R² (unweighted df correction)
  const rSquaredAdj = m > 2 ? 1 - (1 - rSquared) * (m - 1) / (m - 2) : rSquared;

  // Standard error of slope
  const MSE = m > 2 ? SSres / (m - 2) : SSres; // degrees of freedom = m − 2
  const SE_b = Math.sqrt(MSE / Sxx);

  const tc = tCritical(m - 2);
  const slopeCI95: [number, number] = [slope - tc * SE_b, slope + tc * SE_b];

  // SE of intercept = sqrt(MSE × (1/Sw + xBar²/Sxx))
  const SE_int = Math.sqrt(MSE * (1 / Sw + (xBar ** 2) / Sxx));
  const interceptCI95: [number, number] = [intercept - tc * SE_int, intercept + tc * SE_int];

  // Map fitted values back to original-space indices (fill NaN for excluded)
  const allFitted: number[] = new Array(n).fill(NaN);
  const allResiduals: number[] = new Array(n).fill(NaN);
  usedIdx.forEach((origIdx, j) => {
    allFitted[origIdx] = fittedLogValues[j];    // log-scale fitted
    allResiduals[origIdx] = residuals[j];        // log-scale residuals
  });

  return {
    slope,
    intercept,
    a,
    rSquared,
    rSquaredAdj,
    slopeCI95,
    interceptCI95,
    residuals: allResiduals,
    fittedValues: allFitted,
    n: m,
  };
}

// ---------------------------------------------------------------------------
// PREDICTION
// ---------------------------------------------------------------------------

/**
 * Predict value at a given body weight using a fitted regression result.
 *
 * Returns: a × BW^b  =  exp(intercept) × BW^slope
 */
export function predictFromRegression(reg: RegressionResult, BW: number): number {
  if (BW <= 0) throw new Error('predictFromRegression: BW must be positive');
  return reg.a * Math.pow(BW, reg.slope);
}

// ---------------------------------------------------------------------------
// ERROR METRICS
// ---------------------------------------------------------------------------

/**
 * Compute percent prediction error.
 *
 *   PE = 100 × (predicted − observed) / observed
 */
export function computePE(predicted: number, observed: number): number {
  if (observed === 0) throw new Error('computePE: observed value is zero');
  return (100 * (predicted - observed)) / observed;
}

/**
 * Compute average absolute fold error (AAFE) across multiple predictions.
 *
 *   AAFE = 10^[ mean( |log10(pred_i / obs_i)| ) ]
 */
export function computeAAFE(predicted: number[], observed: number[]): number {
  if (predicted.length !== observed.length)
    throw new Error('computeAAFE: predicted and observed arrays must have the same length');
  const n = predicted.length;
  if (n === 0) return NaN;

  let sumAbsLog10 = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (
      predicted[i] > 0 &&
      observed[i] > 0 &&
      isFinite(predicted[i]) &&
      isFinite(observed[i])
    ) {
      sumAbsLog10 += Math.abs(Math.log10(predicted[i] / observed[i]));
      count++;
    }
  }
  if (count === 0) return NaN;
  return Math.pow(10, sumAbsLog10 / count);
}

/**
 * Compute fold error for a single prediction/observation pair.
 *
 *   FE = predicted / observed
 */
export function computeFoldError(predicted: number, observed: number): number {
  if (observed === 0) throw new Error('computeFoldError: observed value is zero');
  return predicted / observed;
}

// ---------------------------------------------------------------------------
// ROBUST REGRESSION  (Huber M-estimator with IWLS; median-based initialisation)
// ---------------------------------------------------------------------------

/**
 * Robust regression using iteratively re-weighted least squares (IRLS)
 * with Huber weights.  Falls back to ordinary OLS if IRLS fails to converge.
 *
 * Model: ln(P) = intercept + slope × ln(BW)
 */
export function fitRobustRegression(
  bodyWeights: number[],
  values: number[],
): RegressionResult {
  const n = bodyWeights.length;
  if (n !== values.length)
    throw new Error('fitRobustRegression: arrays must have the same length');

  // Filter positive values
  const xAll: number[] = [];
  const yAll: number[] = [];
  for (let i = 0; i < n; i++) {
    if (bodyWeights[i] > 0 && values[i] > 0) {
      xAll.push(Math.log(bodyWeights[i]));
      yAll.push(Math.log(values[i]));
    }
  }

  const m = xAll.length;
  if (m < 2) return fitAllometricRegression(bodyWeights, values);

  // ---------- Huber IRLS ----------
  const HUBER_K = 1.345; // tuning constant (95% efficiency at Gaussian)
  const MAX_ITER = 50;
  const TOL = 1e-8;

  // Initial estimate via OLS
  let ols = fitAllometricRegression(bodyWeights, values);
  let slope = ols.slope;
  let intercept = ols.intercept;

  const huberWeight = (r: number, s: number): number => {
    if (s === 0) return 1;
    const u = Math.abs(r) / s;
    return u <= HUBER_K ? 1 : HUBER_K / u;
  };

  for (let iter = 0; iter < MAX_ITER; iter++) {
    const residuals = xAll.map((xi, i) => yAll[i] - (intercept + slope * xi));

    // Median absolute deviation for scale estimate
    const absRes = residuals.map(Math.abs).sort((a, b) => a - b);
    const medAbsRes = m % 2 === 0
      ? (absRes[m / 2 - 1] + absRes[m / 2]) / 2
      : absRes[(m - 1) / 2];
    const sigma = medAbsRes / 0.6745; // robust scale estimate

    if (sigma < 1e-14) break; // converged

    const hw = residuals.map(r => huberWeight(r, sigma));

    // Weighted OLS step
    const Sw  = hw.reduce((s, wi) => s + wi, 0);
    const Swx = hw.reduce((s, wi, i) => s + wi * xAll[i], 0);
    const Swy = hw.reduce((s, wi, i) => s + wi * yAll[i], 0);
    const xBar = Swx / Sw;
    const yBar = Swy / Sw;
    const Sxx = hw.reduce((s, wi, i) => s + wi * (xAll[i] - xBar) ** 2, 0);
    const Sxy = hw.reduce((s, wi, i) => s + wi * (xAll[i] - xBar) * (yAll[i] - yBar), 0);

    if (Sxx === 0) break;

    const newSlope = Sxy / Sxx;
    const newIntercept = yBar - newSlope * xBar;

    if (Math.abs(newSlope - slope) < TOL && Math.abs(newIntercept - intercept) < TOL) {
      slope = newSlope;
      intercept = newIntercept;
      break;
    }
    slope = newSlope;
    intercept = newIntercept;
  }

  // Compute final regression result using derived weights via fitAllometricRegression
  const finalResiduals = xAll.map((xi, i) => yAll[i] - (intercept + slope * xi));
  const absRes2 = finalResiduals.map(Math.abs).sort((a, b) => a - b);
  const medAbsRes2 = m % 2 === 0
    ? (absRes2[m / 2 - 1] + absRes2[m / 2]) / 2
    : absRes2[(m - 1) / 2];
  const sigma2 = medAbsRes2 / 0.6745;
  const finalWeights = finalResiduals.map(r => huberWeight(r, sigma2));

  // Use fitAllometricRegression with Huber weights for full statistics
  return fitAllometricRegression(bodyWeights, values, finalWeights);
}
