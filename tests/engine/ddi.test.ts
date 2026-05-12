import { describe, it, expect } from 'vitest';
import { runDDI } from '@/engine/ddi';
import {
  R1_ratio,
  TDI_lambda,
  TDI_remainingActivity,
  R2_ratio,
  assessReversibleInhibition,
  assessTDI,
} from '@/engine/ddi/inhibition';
import { foldInduction, assessInduction } from '@/engine/ddi/induction';
import { transporterR, assessTransporterInhibition } from '@/engine/ddi/transporters';
import { AUCR_complete_inhibition, AUCR_partial, assessSubstratePaths } from '@/engine/ddi/substrate';
import { DDI_SAMPLE } from '@/data/samples';

// ---- Substrate assessment ----

describe('AUCR_complete_inhibition', () => {
  it('fm=0.80 → AUCR = 5', () => {
    expect(AUCR_complete_inhibition(0.80)).toBeCloseTo(5.0, 2);
  });

  it('fm=0 → AUCR = 1 (not a substrate)', () => {
    expect(AUCR_complete_inhibition(0)).toBeCloseTo(1.0, 4);
  });

  it('fm=1 → AUCR = Infinity', () => {
    expect(AUCR_complete_inhibition(1.0)).toBe(Infinity);
  });

  it('fm=0.50 → AUCR = 2', () => {
    expect(AUCR_complete_inhibition(0.50)).toBeCloseTo(2.0, 4);
  });
});

describe('AUCR_partial', () => {
  it('inhibitionFactor=1 (no inhibition) → AUCR = 1', () => {
    expect(AUCR_partial(0.8, 1)).toBeCloseTo(1.0, 4);
  });

  it('inhibitionFactor=Infinity (complete inhibition) → matches AUCR_complete', () => {
    const fm = 0.8;
    const aucrComplete = AUCR_complete_inhibition(fm);
    const aucrPartial = AUCR_partial(fm, Infinity);
    expect(aucrPartial).toBeCloseTo(aucrComplete, 1);
  });
});

describe('assessSubstratePaths', () => {
  it('marks CYP3A4 fm=0.65 as major substrate', () => {
    const results = assessSubstratePaths([{ enzyme: 'CYP3A4', fm: 0.65 }]);
    expect(results[0].isMajor).toBe(true);
  });

  it('marks CYP3A4 fm=0.80 as sensitive substrate', () => {
    const results = assessSubstratePaths([{ enzyme: 'CYP3A4', fm: 0.80 }]);
    expect(results[0].isSensitive).toBe(true);
  });

  it('CYP2D6 fm=0.15 is minor substrate', () => {
    const results = assessSubstratePaths([{ enzyme: 'CYP2D6', fm: 0.15 }]);
    expect(results[0].isMajor).toBe(false);
    expect(results[0].isSensitive).toBe(false);
  });
});

// ---- Reversible inhibition ----

describe('R1_ratio', () => {
  it('R1 = 1 + Iu/Ki', () => {
    expect(R1_ratio(0.5, 2.5)).toBeCloseTo(1.2, 4);
  });

  it('R1 = 1 when Iu = 0', () => {
    expect(R1_ratio(0, 2.5)).toBe(1.0);
  });
});

describe('assessReversibleInhibition', () => {
  it('flags risk when R1 ≥ 1.02 (EMA)', () => {
    const result = assessReversibleInhibition(
      [{ enzyme: 'CYP3A4', Ki: 2.5, Iu_max: 0.5, mechanism: 'competitive' }],
      1.02,
      1.1
    );
    expect(result.length).toBeGreaterThan(0);
    // R1 = 1 + 0.5/2.5 = 1.2 → risk at EMA threshold 1.02
    expect(result[0].risk).not.toBe('no_risk');
  });

  it('no risk when Iu is very low relative to Ki', () => {
    const result = assessReversibleInhibition(
      [{ enzyme: 'CYP3A4', Ki: 250, Iu_max: 0.001, mechanism: 'competitive' }],
      1.02,
      1.1
    );
    // R1 = 1 + 0.001/250 = 1.000004 → no risk
    expect(result[0].risk).toBe('no_risk');
  });
});

// ---- Time-dependent inhibition ----

describe('TDI_lambda', () => {
  it('lambda = kinact × Iu / (KI + Iu)', () => {
    const kinact = 1.2;
    const KI = 0.8;
    const Iu = 0.5;
    const expected = (kinact * Iu) / (KI + Iu);
    expect(TDI_lambda(kinact, KI, Iu)).toBeCloseTo(expected, 6);
  });

  it('approaches kinact when Iu >> KI', () => {
    const kinact = 1.2;
    const KI = 0.8;
    const Iu = 1000;
    expect(TDI_lambda(kinact, KI, Iu)).toBeCloseTo(kinact, 1);
  });
});

describe('TDI_remainingActivity', () => {
  it('= kdeg / (kdeg + lambda)', () => {
    const kdeg = 0.0193;
    const lambda = 0.46;
    const expected = kdeg / (kdeg + lambda);
    expect(TDI_remainingActivity(kdeg, lambda)).toBeCloseTo(expected, 6);
  });

  it('is 1 when lambda = 0 (no inactivation)', () => {
    expect(TDI_remainingActivity(0.02, 0)).toBe(1.0);
  });

  it('approaches 0 when lambda >> kdeg', () => {
    expect(TDI_remainingActivity(0.02, 1000)).toBeCloseTo(0, 3);
  });
});

describe('R2_ratio', () => {
  it('R2 = (kdeg + lambda) / kdeg', () => {
    const kdeg = 0.02;
    const lambda = 0.46;
    const expected = (kdeg + lambda) / kdeg;
    expect(R2_ratio(kdeg, lambda)).toBeCloseTo(expected, 4);
  });
});

// ---- Induction ----

describe('foldInduction', () => {
  it('Emax model: fold = 1 + Emax×I/(EC50+I)', () => {
    const Emax = 10;
    const EC50 = 1.0;
    const I = 1.0;
    const expected = 1 + (Emax * I) / (EC50 + I);
    expect(foldInduction(Emax, EC50, I)).toBeCloseTo(expected, 6);
  });

  it('fold = 1 when I = 0', () => {
    expect(foldInduction(10, 1.0, 0)).toBe(1.0);
  });

  it('approaches Emax+1 when I >> EC50', () => {
    expect(foldInduction(10, 1.0, 10000)).toBeCloseTo(11.0, 1);
  });
});

// ---- Transporter inhibition ----

describe('transporterR', () => {
  it('R = 1 + I/IC50', () => {
    expect(transporterR(20, 5)).toBeCloseTo(5.0, 4);
  });

  it('R = 1 when I = 0', () => {
    expect(transporterR(0, 5)).toBe(1.0);
  });
});

// ---- Full DDI run ----

describe('runDDI', () => {
  it('runs without error on sample dataset', () => {
    const result = runDDI(DDI_SAMPLE);
    expect(result).toBeDefined();
  });

  it('produces substrate results for all pathways', () => {
    const result = runDDI(DDI_SAMPLE);
    // Sample has CYP3A4 and CYP2D6 substrates
    expect(result.substrateResults.length).toBeGreaterThan(0);
  });

  it('produces reversible inhibition results', () => {
    const result = runDDI(DDI_SAMPLE);
    expect(result.reversibleInhibitionResults.length).toBeGreaterThan(0);
  });

  it('produces TDI results', () => {
    const result = runDDI(DDI_SAMPLE);
    expect(result.TDIResults.length).toBeGreaterThan(0);
  });

  it('produces transporter results', () => {
    const result = runDDI(DDI_SAMPLE);
    expect(result.transporterResults.length).toBeGreaterThan(0);
  });

  it('generates a risk matrix', () => {
    const result = runDDI(DDI_SAMPLE);
    expect(result.riskMatrix.length).toBeGreaterThan(0);
  });

  it('overall risk is one of the valid levels', () => {
    const result = runDDI(DDI_SAMPLE);
    expect(['no_risk', 'potential_risk', 'risk', 'high_risk']).toContain(result.overallRisk);
  });
});
