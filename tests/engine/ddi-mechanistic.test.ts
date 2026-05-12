import { describe, it, expect } from 'vitest';
import {
  computeReversibleContribution,
  computeTDIContribution,
  computeInductionContribution,
  computeMechanisticStatic,
} from '@/engine/ddi/mechanisticStatic';
import { parseDDIBatchCSV } from '@/utils/csvImport';
import type { MechanisticStaticInputs, MechanisticStaticEnzymeInputs } from '@/types';

// ---------------------------------------------------------------------------
// computeReversibleContribution
// ---------------------------------------------------------------------------

describe('computeReversibleContribution', () => {
  it('Ki=2.5, Iu=0.5 → R_rev=1.2, activity_rev≈0.833', () => {
    const { R_rev, activity_rev } = computeReversibleContribution(2.5, 0.5);
    expect(R_rev).toBeCloseTo(1.2, 6);
    expect(activity_rev).toBeCloseTo(2.5 / (2.5 + 0.5), 6); // ≈ 0.8333
  });

  it('Iu=0 → R_rev=1, activity_rev=1 (no inhibition)', () => {
    const { R_rev, activity_rev } = computeReversibleContribution(2.5, 0);
    expect(R_rev).toBeCloseTo(1.0, 6);
    expect(activity_rev).toBeCloseTo(1.0, 6);
  });

  it('throws when Ki <= 0', () => {
    expect(() => computeReversibleContribution(0, 0.5)).toThrow();
    expect(() => computeReversibleContribution(-1, 0.5)).toThrow();
  });

  it('activity_rev = Ki / (Ki + Iu) ≡ 1 / R_rev', () => {
    const Ki = 3.0;
    const Iu = 1.5;
    const { R_rev, activity_rev } = computeReversibleContribution(Ki, Iu);
    expect(activity_rev).toBeCloseTo(1 / R_rev, 10);
    expect(activity_rev).toBeCloseTo(Ki / (Ki + Iu), 10);
  });
});

// ---------------------------------------------------------------------------
// computeTDIContribution
// ---------------------------------------------------------------------------

describe('computeTDIContribution', () => {
  it('kinact=1.2, KI=0.8, Iu=0.5, kdeg=0.0193 → lambda≈0.462', () => {
    // lambda = 1.2 * 0.5 / (0.8 + 0.5) = 0.6 / 1.3 ≈ 0.46154
    const { lambda, R_TDI, activity_TDI } = computeTDIContribution(1.2, 0.8, 0.5, 0.0193);
    expect(lambda).toBeCloseTo((1.2 * 0.5) / (0.8 + 0.5), 6);
    const expectedR_TDI = (0.0193 + lambda) / 0.0193;
    expect(R_TDI).toBeCloseTo(expectedR_TDI, 6);
    expect(activity_TDI).toBeCloseTo(1 / R_TDI, 6);
  });

  it('Iu=0 → lambda=0, R_TDI=1, activity_TDI=1 (no TDI)', () => {
    const { lambda, R_TDI, activity_TDI } = computeTDIContribution(1.2, 0.8, 0, 0.0193);
    expect(lambda).toBeCloseTo(0, 10);
    expect(R_TDI).toBeCloseTo(1.0, 6);
    expect(activity_TDI).toBeCloseTo(1.0, 6);
  });

  it('activity_TDI = kdeg / (kdeg + lambda) ≡ 1 / R_TDI', () => {
    const kdeg = 0.0193;
    const { lambda, R_TDI, activity_TDI } = computeTDIContribution(1.2, 0.8, 0.5, kdeg);
    expect(activity_TDI).toBeCloseTo(kdeg / (kdeg + lambda), 10);
    expect(activity_TDI).toBeCloseTo(1 / R_TDI, 10);
  });

  it('throws when kdeg <= 0', () => {
    expect(() => computeTDIContribution(1.2, 0.8, 0.5, 0)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// computeInductionContribution
// ---------------------------------------------------------------------------

describe('computeInductionContribution', () => {
  it('Emax=3, EC50=1, Iu=2 → fold_induction=3.0', () => {
    // fold = 1 + 3 * 2 / (1 + 2) = 1 + 6/3 = 1 + 2 = 3
    const { fold_induction } = computeInductionContribution(3, 1, 2);
    expect(fold_induction).toBeCloseTo(3.0, 6);
  });

  it('Emax=0, EC50=1, Iu=1 → fold_induction=1.0 (no induction)', () => {
    const { fold_induction } = computeInductionContribution(0, 1, 1);
    expect(fold_induction).toBeCloseTo(1.0, 6);
  });

  it('Iu=0 → fold_induction=1.0 (no drug)', () => {
    const { fold_induction } = computeInductionContribution(10, 1, 0);
    expect(fold_induction).toBeCloseTo(1.0, 6);
  });

  it('approaches Emax+1 when Iu >> EC50', () => {
    const { fold_induction } = computeInductionContribution(5, 0.1, 10000);
    expect(fold_induction).toBeCloseTo(6.0, 1);
  });

  it('throws when Emax < 0', () => {
    expect(() => computeInductionContribution(-1, 1, 1)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// computeMechanisticStatic — reversible only
// ---------------------------------------------------------------------------

describe('computeMechanisticStatic — reversible inhibition only', () => {
  function makeInput(overrides: Partial<MechanisticStaticEnzymeInputs>): MechanisticStaticInputs {
    return {
      compound: { name: 'Test' },
      template: 'FDA_2020',
      enzymes: [
        {
          enzyme: 'CYP3A4',
          fm: 0.65,
          useReversible: true,
          Ki_rev: 2.5,
          Iu_rev: 0.5,
          useTDI: false,
          useInduction: false,
          kdeg: 0.0193,
          ...overrides,
        },
      ],
    };
  }

  it('reversible inhibition only → net_activity < 1, AUCR > 1', () => {
    const result = computeMechanisticStatic(makeInput({}));
    const r = result.enzymeResults[0];
    expect(r.intermediates.net_activity_ratio).toBeLessThan(1);
    expect(r.intermediates.AUCR).toBeGreaterThan(1);
  });

  it('fm=0 → AUCR=1.0 (no effect regardless of perpetrator)', () => {
    const result = computeMechanisticStatic(makeInput({ fm: 0 }));
    const r = result.enzymeResults[0];
    expect(r.intermediates.AUCR).toBeCloseTo(1.0, 6);
  });
});

// ---------------------------------------------------------------------------
// computeMechanisticStatic — induction only
// ---------------------------------------------------------------------------

describe('computeMechanisticStatic — induction only', () => {
  it('induction only → net_activity > 1, AUCR < 1', () => {
    const inputs: MechanisticStaticInputs = {
      compound: { name: 'Inducer' },
      template: 'FDA_2020',
      enzymes: [
        {
          enzyme: 'CYP3A4',
          fm: 0.65,
          useReversible: false,
          useTDI: false,
          useInduction: true,
          Emax: 3,
          EC50_ind: 1,
          Iu_ind: 2,
          kdeg: 0.0193,
        },
      ],
    };
    const result = computeMechanisticStatic(inputs);
    const r = result.enzymeResults[0];
    expect(r.intermediates.net_activity_ratio).toBeGreaterThan(1);
    expect(r.intermediates.AUCR).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// computeMechanisticStatic — combined
// ---------------------------------------------------------------------------

describe('computeMechanisticStatic — combined inhibition + induction', () => {
  it('strong inhibition dominates → AUCR > 1', () => {
    const inputs: MechanisticStaticInputs = {
      compound: { name: 'Both' },
      template: 'FDA_2020',
      enzymes: [
        {
          enzyme: 'CYP3A4',
          fm: 0.65,
          useReversible: true,
          Ki_rev: 0.1,   // very strong inhibitor
          Iu_rev: 1.0,
          useTDI: false,
          useInduction: true,
          Emax: 1,
          EC50_ind: 1,
          Iu_ind: 0.1,   // weak inducer
          kdeg: 0.0193,
        },
      ],
    };
    const result = computeMechanisticStatic(inputs);
    expect(result.enzymeResults[0].intermediates.AUCR).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// Risk classification
// ---------------------------------------------------------------------------

describe('computeMechanisticStatic — risk classification', () => {
  function makeWithAUCR(targetAUCR: number): MechanisticStaticInputs {
    // AUCR = 1 / (fm × (1/net) + (1-fm))
    // With fm=1 and only reversible inhibition: AUCR = 1/activity_rev = R_rev
    // So set fm=1, Ki such that R_rev = targetAUCR
    // R_rev = 1 + Iu/Ki → Ki = Iu / (R_rev - 1)
    const Iu = 1.0;
    const Ki = Iu / (targetAUCR - 1);
    return {
      compound: { name: 'Risk test' },
      template: 'FDA_2020',
      enzymes: [
        {
          enzyme: 'CYP3A4',
          fm: 1.0,
          useReversible: true,
          Ki_rev: Ki,
          Iu_rev: Iu,
          useTDI: false,
          useInduction: false,
          kdeg: 0.0193,
        },
      ],
    };
  }

  it('AUCR ≥ 5 → high_risk', () => {
    // Use AUCR=5.5 → R_rev=5.5 → Ki = 1/(5.5-1) = 1/4.5
    const result = computeMechanisticStatic(makeWithAUCR(5.5));
    expect(result.enzymeResults[0].risk).toBe('high_risk');
  });

  it('AUCR ≥ 2, < 5 → risk', () => {
    const result = computeMechanisticStatic(makeWithAUCR(2.5));
    expect(result.enzymeResults[0].risk).toBe('risk');
  });

  it('AUCR ≥ 1.25, < 2 → potential_risk', () => {
    const result = computeMechanisticStatic(makeWithAUCR(1.5));
    expect(result.enzymeResults[0].risk).toBe('potential_risk');
  });

  it('AUCR < 1.25 and > 0.8 → no_risk', () => {
    // AUCR close to 1 — weak inhibitor
    const result = computeMechanisticStatic(makeWithAUCR(1.05));
    expect(result.enzymeResults[0].risk).toBe('no_risk');
  });

  it('strong induction AUCR ≤ 0.8 → risk', () => {
    // Induction with AUCR < 0.8
    const inputs: MechanisticStaticInputs = {
      compound: { name: 'StrongInducer' },
      template: 'FDA_2020',
      enzymes: [
        {
          enzyme: 'CYP3A4',
          fm: 1.0,
          useReversible: false,
          useTDI: false,
          useInduction: true,
          Emax: 20,
          EC50_ind: 0.1,
          Iu_ind: 5.0,   // very high conc → near-maximum induction
          kdeg: 0.0193,
        },
      ],
    };
    const result = computeMechanisticStatic(inputs);
    const r = result.enzymeResults[0];
    expect(r.intermediates.AUCR).toBeLessThanOrEqual(0.8);
    expect(r.risk).toBe('risk');
  });
});

// ---------------------------------------------------------------------------
// parseDDIBatchCSV
// ---------------------------------------------------------------------------

describe('parseDDIBatchCSV', () => {
  it('maps rows to BatchDDIRecord[] with correct compound grouping info', () => {
    const rows = [
      { compound_name: 'Compound_X', enzyme_or_transporter: 'CYP3A4', pathway_type: 'substrate',
        fm: 0.65, Ki_uM: null, IC50_uM: null, kinact_per_h: null, KI_uM: null,
        Emax_fold: null, EC50_uM: null, concentration_metric_type: null,
        concentration_value_uM: null, unbound_fraction: null,
        substrate_flag: true, perpetrator_flag: false, comments: 'test substrate' },
      { compound_name: 'Compound_X', enzyme_or_transporter: 'CYP3A4', pathway_type: 'reversible_inhibitor',
        fm: null, Ki_uM: 2.5, IC50_uM: null, kinact_per_h: null, KI_uM: null,
        Emax_fold: null, EC50_uM: null, concentration_metric_type: 'Iu_max',
        concentration_value_uM: 0.5, unbound_fraction: 1.0,
        substrate_flag: false, perpetrator_flag: true, comments: null },
      { compound_name: 'Compound_Y', enzyme_or_transporter: 'CYP2D6', pathway_type: 'substrate',
        fm: 0.80, Ki_uM: null, IC50_uM: null, kinact_per_h: null, KI_uM: null,
        Emax_fold: null, EC50_uM: null, concentration_metric_type: null,
        concentration_value_uM: null, unbound_fraction: null,
        substrate_flag: true, perpetrator_flag: false, comments: null },
    ];

    const records = parseDDIBatchCSV(rows);

    expect(records).toHaveLength(3);
    // Compound names preserved
    expect(records[0].compound_name).toBe('Compound_X');
    expect(records[1].compound_name).toBe('Compound_X');
    expect(records[2].compound_name).toBe('Compound_Y');
    // Pathway types
    expect(records[0].pathway_type).toBe('substrate');
    expect(records[1].pathway_type).toBe('reversible_inhibitor');
    // Numeric fields
    expect(records[0].fm).toBeCloseTo(0.65, 6);
    expect(records[1].Ki).toBeCloseTo(2.5, 6);
    expect(records[1].concentration_value).toBeCloseTo(0.5, 6);
    // Missing numeric fields are undefined
    expect(records[0].Ki).toBeUndefined();
    // Comments
    expect(records[0].comments).toBe('test substrate');
    expect(records[2].comments).toBeUndefined();
  });

  it('maps pathway_type strings case-insensitively', () => {
    const rows = [
      { compound_name: 'A', enzyme_or_transporter: 'CYP3A4', pathway_type: 'TDI',
        fm: null, Ki_uM: null, IC50_uM: null, kinact_per_h: 1.2, KI_uM: 0.8,
        Emax_fold: null, EC50_uM: null, concentration_metric_type: null,
        concentration_value_uM: 0.5, unbound_fraction: null,
        substrate_flag: false, perpetrator_flag: true, comments: null },
      { compound_name: 'A', enzyme_or_transporter: 'CYP3A4', pathway_type: 'inducer',
        fm: null, Ki_uM: null, IC50_uM: null, kinact_per_h: null, KI_uM: null,
        Emax_fold: 3.0, EC50_uM: 1.0, concentration_metric_type: null,
        concentration_value_uM: 2.0, unbound_fraction: null,
        substrate_flag: false, perpetrator_flag: true, comments: null },
    ];
    const records = parseDDIBatchCSV(rows);
    expect(records[0].pathway_type).toBe('TDI');
    expect(records[1].pathway_type).toBe('inducer');
    expect(records[0].kinact).toBeCloseTo(1.2, 6);
    expect(records[1].Emax).toBeCloseTo(3.0, 6);
  });

  it('filters out rows with empty compound_name', () => {
    const rows = [
      { compound_name: '', enzyme_or_transporter: 'CYP3A4', pathway_type: 'substrate',
        fm: 0.5, Ki_uM: null, IC50_uM: null, kinact_per_h: null, KI_uM: null,
        Emax_fold: null, EC50_uM: null, concentration_metric_type: null,
        concentration_value_uM: null, unbound_fraction: null,
        substrate_flag: true, perpetrator_flag: false, comments: null },
      { compound_name: 'Valid', enzyme_or_transporter: 'CYP2D6', pathway_type: 'substrate',
        fm: 0.8, Ki_uM: null, IC50_uM: null, kinact_per_h: null, KI_uM: null,
        Emax_fold: null, EC50_uM: null, concentration_metric_type: null,
        concentration_value_uM: null, unbound_fraction: null,
        substrate_flag: true, perpetrator_flag: false, comments: null },
    ];
    const records = parseDDIBatchCSV(rows);
    expect(records).toHaveLength(1);
    expect(records[0].compound_name).toBe('Valid');
  });
});
