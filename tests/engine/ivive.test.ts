import { describe, it, expect } from 'vitest';
import { runIVIVE, computeSpeciesIVIVE } from '@/engine/ivive';
import {
  wellStirredNoBind,
  wellStirredWithBind,
  parallelTube,
  extractionRatio,
  scaleCLint_microsomal,
  categorizeExtraction,
} from '@/engine/ivive/models';
import { IVIVE_SAMPLE } from '@/data/samples';

// ---- Unit tests for individual model functions ----

describe('scaleCLint_microsomal', () => {
  it('scales correctly: 85 µL/min/mg × 45 mg/g × 1800g / 1000 = 6885 mL/min', () => {
    const result = scaleCLint_microsomal(85, 45, 1800);
    expect(result).toBeCloseTo(6885, 0);
  });

  it('returns 0 for zero CLint', () => {
    expect(scaleCLint_microsomal(0, 45, 1800)).toBe(0);
  });
});

describe('wellStirredNoBind', () => {
  it('cannot exceed hepatic blood flow', () => {
    const Qh = 1500;
    const CLint = 999999; // very high
    const CLh = wellStirredNoBind(Qh, CLint);
    expect(CLh).toBeLessThan(Qh);
  });

  it('is ~CLint when CLint << Qh (low extraction)', () => {
    const Qh = 1500;
    const CLint = 1; // << Qh: CLh ≈ 1500×1/1501 ≈ 0.999
    const CLh = wellStirredNoBind(Qh, CLint);
    // Should be within 1% of CLint
    expect(CLh / CLint).toBeGreaterThan(0.99);
    expect(CLh).toBeLessThan(CLint);
  });

  it('approaches Qh when CLint >> Qh (high extraction)', () => {
    const Qh = 1500;
    const CLint = 150000; // >> Qh
    const CLh = wellStirredNoBind(Qh, CLint);
    expect(CLh / Qh).toBeGreaterThan(0.99);
  });

  it('formula: CLh = Qh×CLint/(Qh+CLint)', () => {
    const Qh = 1500;
    const CLint = 500;
    const expected = (Qh * CLint) / (Qh + CLint);
    expect(wellStirredNoBind(Qh, CLint)).toBeCloseTo(expected, 6);
  });
});

describe('wellStirredWithBind', () => {
  it('formula: CLh = Qh×fuB×CLint/(Qh+fuB×CLint)', () => {
    const Qh = 1500;
    const fuB = 0.08;
    const CLint = 5000;
    const expected = (Qh * fuB * CLint) / (Qh + fuB * CLint);
    expect(wellStirredWithBind(Qh, fuB, CLint)).toBeCloseTo(expected, 6);
  });

  it('lower bound clearance with binding vs no binding', () => {
    const Qh = 1500;
    const CLint = 5000;
    const fuB = 0.5; // < 1.0
    const withBind = wellStirredWithBind(Qh, fuB, CLint);
    const noBind = wellStirredNoBind(Qh, CLint);
    expect(withBind).toBeLessThanOrEqual(noBind);
  });
});

describe('parallelTube', () => {
  it('formula: CLh = Qh × [1 - exp(-fuB×CLint/Qh)]', () => {
    const Qh = 1500;
    const fuB = 0.08;
    const CLint = 5000;
    const expected = Qh * (1 - Math.exp(-fuB * CLint / Qh));
    expect(parallelTube(Qh, fuB, CLint)).toBeCloseTo(expected, 6);
  });

  it('approaches Qh for high extraction', () => {
    const Qh = 1500;
    const fuB = 1.0;
    const CLint = 1e8;
    expect(parallelTube(Qh, fuB, CLint) / Qh).toBeGreaterThan(0.999);
  });
});

describe('extractionRatio', () => {
  it('Eh = CLh / Qh', () => {
    expect(extractionRatio(750, 1500)).toBeCloseTo(0.5, 6);
  });

  it('is between 0 and 1', () => {
    const Eh = extractionRatio(300, 1500);
    expect(Eh).toBeGreaterThanOrEqual(0);
    expect(Eh).toBeLessThanOrEqual(1);
  });
});

describe('categorizeExtraction', () => {
  it('low for Eh < 0.3', () => {
    expect(categorizeExtraction(0.1)).toBe('low');
    expect(categorizeExtraction(0.29)).toBe('low');
  });

  it('medium for 0.3 ≤ Eh ≤ 0.7', () => {
    expect(categorizeExtraction(0.3)).toBe('medium');
    expect(categorizeExtraction(0.5)).toBe('medium');
    expect(categorizeExtraction(0.7)).toBe('medium');
  });

  it('high for Eh > 0.7', () => {
    expect(categorizeExtraction(0.71)).toBe('high');
    expect(categorizeExtraction(0.95)).toBe('high');
  });
});

// ---- Integration test ----

describe('runIVIVE', () => {
  it('runs without error on sample dataset', () => {
    const result = runIVIVE(IVIVE_SAMPLE);
    expect(result).toBeDefined();
    expect(result.speciesResults.length).toBeGreaterThan(0);
  });

  it('produces positive CLh for human', () => {
    const result = runIVIVE(IVIVE_SAMPLE);
    const humanResult = result.speciesResults.find(r => r.species === 'human');
    expect(humanResult).toBeDefined();
    if (humanResult) {
      for (const m of humanResult.modelOutputs) {
        expect(m.CLh_predicted).toBeGreaterThan(0);
      }
    }
  });

  it('extraction ratio between 0 and 1 for all models', () => {
    const result = runIVIVE(IVIVE_SAMPLE);
    for (const sr of result.speciesResults) {
      for (const m of sr.modelOutputs) {
        expect(m.Eh).toBeGreaterThanOrEqual(0);
        expect(m.Eh).toBeLessThanOrEqual(1);
      }
    }
  });
});
