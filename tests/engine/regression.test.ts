import { describe, it, expect } from 'vitest';
import {
  fitAllometricRegression,
  predictFromRegression,
  computePE,
  computeAAFE,
  computeFoldError,
} from '@/engine/allometry/regression';

// Known allometric dataset: CL (mL/min) vs BW (kg) for 4 species
// Mouse (0.02kg, 1.2mL/min), Rat (0.25kg, 7.5mL/min), Dog (11.3kg, 113mL/min), Human(70kg, ~600mL/min expected)
const TEST_BW = [0.02, 0.25, 11.3, 70];
const TEST_CL = [1.2, 7.5, 113.0, 600.0];

describe('fitAllometricRegression', () => {
  it('produces correct slope for well-behaved allometric data', () => {
    const result = fitAllometricRegression([0.02, 0.25, 11.3], [1.2, 7.5, 113.0]);
    // Slope should be close to 0.75 for metabolic allometry
    expect(result.slope).toBeGreaterThan(0.5);
    expect(result.slope).toBeLessThan(1.1);
  });

  it('has R² near 1 for perfect allometric relationship', () => {
    // Perfect P = 5 × BW^0.75
    const bws = [0.02, 0.25, 1.0, 5.0, 11.3, 70];
    const vals = bws.map(bw => 5 * Math.pow(bw, 0.75));
    const result = fitAllometricRegression(bws, vals);
    expect(result.rSquared).toBeGreaterThan(0.999);
    expect(result.slope).toBeCloseTo(0.75, 4);
    expect(result.a).toBeCloseTo(5, 3);
  });

  it('returns residuals of length n', () => {
    const result = fitAllometricRegression([0.02, 0.25, 11.3], [1.2, 7.5, 113.0]);
    expect(result.residuals).toHaveLength(3);
  });

  it('returns n correctly', () => {
    const result = fitAllometricRegression(TEST_BW.slice(0, 4), TEST_CL.slice(0, 4));
    expect(result.n).toBe(4);
  });

  it('throws or returns NaN for single data point', () => {
    expect(() => fitAllometricRegression([1], [10])).toThrow();
  });

  it('computes slope CI when n ≥ 3', () => {
    const result = fitAllometricRegression([0.02, 0.25, 11.3, 70], [1.2, 7.5, 113.0, 600.0]);
    expect(result.slopeCI95).toBeDefined();
    if (result.slopeCI95) {
      expect(result.slopeCI95[0]).toBeLessThan(result.slope);
      expect(result.slopeCI95[1]).toBeGreaterThan(result.slope);
    }
  });
});

describe('predictFromRegression', () => {
  it('predicts correctly using a × BW^b', () => {
    const reg = fitAllometricRegression([0.02, 0.25, 5.0, 70], [1.0, 5.0, 60.0, 400.0]);
    const pred = predictFromRegression(reg, 70);
    // Should be positive
    expect(pred).toBeGreaterThan(0);
  });

  it('recovers training data approximately', () => {
    const bws = [0.02, 0.25, 11.3];
    const vals = bws.map(bw => 5 * Math.pow(bw, 0.75));
    const reg = fitAllometricRegression(bws, vals);
    for (let i = 0; i < bws.length; i++) {
      const pred = predictFromRegression(reg, bws[i]);
      expect(pred).toBeCloseTo(vals[i], 2);
    }
  });
});

describe('computePE', () => {
  it('returns 0 for perfect prediction', () => {
    expect(computePE(10, 10)).toBe(0);
  });

  it('returns 100% for 2× over-prediction', () => {
    expect(computePE(20, 10)).toBe(100);
  });

  it('returns -50% for half the observed value', () => {
    expect(computePE(5, 10)).toBe(-50);
  });
});

describe('computeAAFE', () => {
  it('returns 1 for perfect predictions', () => {
    const pred = [10, 20, 30];
    const obs = [10, 20, 30];
    expect(computeAAFE(pred, obs)).toBeCloseTo(1.0, 4);
  });

  it('returns > 1 for systematically off predictions', () => {
    const pred = [20, 40, 60];  // 2× over
    const obs = [10, 20, 30];
    expect(computeAAFE(pred, obs)).toBeCloseTo(2.0, 2);
  });

  it('is symmetric: 2× over and 0.5× under should give same AAFE', () => {
    const pred1 = [20, 20];   // 2×
    const obs1 = [10, 40];    // 2× over and 0.5× under
    const aafe1 = computeAAFE(pred1, obs1);
    expect(aafe1).toBeCloseTo(2.0, 2);
  });
});

describe('computeFoldError', () => {
  it('returns 2 for 2× over-prediction', () => {
    expect(computeFoldError(20, 10)).toBe(2);
  });

  it('returns 0.5 for half predicted', () => {
    expect(computeFoldError(5, 10)).toBe(0.5);
  });
});
