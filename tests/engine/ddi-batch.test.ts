import { describe, it, expect } from 'vitest';
import { runBatchDDI } from '@/engine/ddi/batch';
import type { BatchDDIRecord } from '@/types';

// ---------------------------------------------------------------------------
// runBatchDDI
// ---------------------------------------------------------------------------

describe('runBatchDDI', () => {
  const records: BatchDDIRecord[] = [
    // Compound_X — CYP3A4 substrate + reversible inhibitor + TDI
    {
      compound_name:         'Compound_X',
      enzyme_or_transporter: 'CYP3A4',
      pathway_type:          'substrate',
      fm:                    0.65,
    },
    {
      compound_name:         'Compound_X',
      enzyme_or_transporter: 'CYP3A4',
      pathway_type:          'reversible_inhibitor',
      Ki:                    2.5,
      concentration_value:   0.5,
    },
    {
      compound_name:         'Compound_X',
      enzyme_or_transporter: 'CYP3A4',
      pathway_type:          'TDI',
      kinact:                1.2,
      KI:                    0.8,
      concentration_value:   0.5,
    },
    // Compound_Y — CYP2D6 substrate + reversible inhibitor + CYP3A4 inducer
    {
      compound_name:         'Compound_Y',
      enzyme_or_transporter: 'CYP2D6',
      pathway_type:          'substrate',
      fm:                    0.80,
    },
    {
      compound_name:         'Compound_Y',
      enzyme_or_transporter: 'CYP2D6',
      pathway_type:          'reversible_inhibitor',
      Ki:                    5.0,
      concentration_value:   1.0,
    },
    {
      compound_name:         'Compound_Y',
      enzyme_or_transporter: 'CYP3A4',
      pathway_type:          'inducer',
      Emax:                  3.0,
      EC50:                  1.0,
      concentration_value:   2.0,
    },
  ];

  it('returns one result per unique compound_name', () => {
    const results = runBatchDDI(records);
    expect(results).toHaveLength(2);
  });

  it('compound names match input', () => {
    const results = runBatchDDI(records);
    const names = results.map(r => r.compound_name);
    expect(names).toContain('Compound_X');
    expect(names).toContain('Compound_Y');
  });

  it('each result has a DDIResults object with expected shape', () => {
    const results = runBatchDDI(records);
    for (const r of results) {
      expect(r.results).toBeDefined();
      expect(r.results.substrateResults).toBeDefined();
      expect(r.results.reversibleInhibitionResults).toBeDefined();
      expect(r.results.TDIResults).toBeDefined();
      expect(r.results.inductionResults).toBeDefined();
      expect(r.results.overallRisk).toBeDefined();
    }
  });

  it('Compound_X has substrate and inhibition results', () => {
    const results = runBatchDDI(records);
    const cx = results.find(r => r.compound_name === 'Compound_X')!;
    expect(cx.results.substrateResults.length).toBeGreaterThan(0);
    expect(
      cx.results.reversibleInhibitionResults.length + cx.results.TDIResults.length,
    ).toBeGreaterThan(0);
  });

  it('Compound_Y has induction results', () => {
    const results = runBatchDDI(records);
    const cy = results.find(r => r.compound_name === 'Compound_Y')!;
    expect(cy.results.inductionResults.length).toBeGreaterThan(0);
  });

  it('empty records returns empty array', () => {
    const results = runBatchDDI([]);
    expect(results).toHaveLength(0);
  });

  it('single compound with only substrate rows returns valid result', () => {
    const single: BatchDDIRecord[] = [
      { compound_name: 'Solo', enzyme_or_transporter: 'CYP2C9', pathway_type: 'substrate', fm: 0.7 },
    ];
    const results = runBatchDDI(single);
    expect(results).toHaveLength(1);
    expect(results[0].compound_name).toBe('Solo');
    expect(results[0].results.overallRisk).toBeDefined();
  });

  it('preserves record order in compound grouping', () => {
    const ordered: BatchDDIRecord[] = [
      { compound_name: 'First',  enzyme_or_transporter: 'CYP3A4', pathway_type: 'substrate', fm: 0.5 },
      { compound_name: 'Second', enzyme_or_transporter: 'CYP2D6', pathway_type: 'substrate', fm: 0.3 },
      { compound_name: 'Third',  enzyme_or_transporter: 'CYP1A2', pathway_type: 'substrate', fm: 0.4 },
    ];
    const results = runBatchDDI(ordered);
    expect(results[0].compound_name).toBe('First');
    expect(results[1].compound_name).toBe('Second');
    expect(results[2].compound_name).toBe('Third');
  });
});
