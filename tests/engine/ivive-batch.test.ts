import { describe, it, expect } from 'vitest';
import { parseIVIVECompoundCSV } from '@/utils/csvImport';
import { runBatchIVIVE } from '@/engine/ivive/batch';
import type { ParsedRow } from '@/utils/csvImport';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const VALID_ROWS: ParsedRow[] = [
  {
    compound_name: 'Compound_A',
    matrix_type: 'microsomes',
    CLint_app: 15.0,
    CLint_unit: 'uL/min/mg',
    fup: 0.08,
    fumic: 0.5,
    fuhep: null,
    blood_to_plasma_ratio: 1.0,
    apply_fumic_correction: 'true',
    observed_CLh: null,
    comments: 'Example microsomal compound',
  },
  {
    compound_name: 'Compound_B',
    matrix_type: 'hepatocytes',
    CLint_app: 8.5,
    CLint_unit: 'uL/min/1e6cells',
    fup: 0.15,
    fumic: null,
    fuhep: 0.7,
    blood_to_plasma_ratio: 0.9,
    apply_fumic_correction: 'false',
    observed_CLh: 12.5,
    comments: 'Example hepatocyte compound',
  },
];

const MISSING_CLINT_ROW: ParsedRow[] = [
  {
    compound_name: 'Compound_X',
    matrix_type: 'microsomes',
    CLint_app: null,
    CLint_unit: 'uL/min/mg',
    fup: 0.1,
    fumic: null,
    fuhep: null,
    blood_to_plasma_ratio: 1.0,
    apply_fumic_correction: 'false',
    observed_CLh: null,
    comments: null,
  },
];

// ---------------------------------------------------------------------------
// parseIVIVECompoundCSV tests
// ---------------------------------------------------------------------------

describe('parseIVIVECompoundCSV', () => {
  it('parses valid rows into correct BatchIVIVERecord[]', () => {
    const records = parseIVIVECompoundCSV(VALID_ROWS);

    expect(records).toHaveLength(2);

    // Compound A — microsomes
    const a = records[0];
    expect(a.compound_name).toBe('Compound_A');
    expect(a.CLint_source).toBe('microsomes');
    expect(a.CLint_app).toBeCloseTo(15.0);
    expect(a.fup).toBeCloseTo(0.08);
    expect(a.fumic).toBeCloseTo(0.5);
    expect(a.fuhep).toBeUndefined();
    expect(a.BP_ratio).toBeCloseTo(1.0);
    expect(a.apply_fumic_correction).toBe(true);
    expect(a.observed_CLh).toBeUndefined();
    expect(a.comments).toBe('Example microsomal compound');

    // Compound B — hepatocytes
    const b = records[1];
    expect(b.compound_name).toBe('Compound_B');
    expect(b.CLint_source).toBe('hepatocytes');
    expect(b.CLint_app).toBeCloseTo(8.5);
    expect(b.fup).toBeCloseTo(0.15);
    expect(b.fumic).toBeUndefined();
    expect(b.fuhep).toBeCloseTo(0.7);
    expect(b.BP_ratio).toBeCloseTo(0.9);
    expect(b.apply_fumic_correction).toBe(false);
    expect(b.observed_CLh).toBeCloseTo(12.5);
  });

  it('defaults BP_ratio to 1.0 when not supplied', () => {
    const rows: ParsedRow[] = [
      {
        compound_name: 'Test',
        matrix_type: 'microsomes',
        CLint_app: 10,
        fup: 0.1,
        fumic: null,
        fuhep: null,
        blood_to_plasma_ratio: null,
        apply_fumic_correction: 'false',
        observed_CLh: null,
        comments: null,
      },
    ];
    const records = parseIVIVECompoundCSV(rows);
    expect(records[0].BP_ratio).toBe(1.0);
  });

  it('parses apply_fumic_correction as boolean', () => {
    const rows: ParsedRow[] = [
      { ...VALID_ROWS[0], apply_fumic_correction: 'true' },
      { ...VALID_ROWS[1], apply_fumic_correction: 'false' },
    ];
    const records = parseIVIVECompoundCSV(rows);
    expect(records[0].apply_fumic_correction).toBe(true);
    expect(records[1].apply_fumic_correction).toBe(false);
  });

  it('maps unknown matrix_type to "microsomes" by default', () => {
    const rows: ParsedRow[] = [
      { ...VALID_ROWS[0], matrix_type: 'liver_s9' },
    ];
    const records = parseIVIVECompoundCSV(rows);
    expect(records[0].CLint_source).toBe('microsomes');
  });

  it('still parses row with missing CLint_app without throwing (validation is separate)', () => {
    // Number(null) → 0; Number(undefined) → NaN; Number('') → 0
    // The parser must not throw — it returns a record, even if CLint_app is 0/NaN
    const records = parseIVIVECompoundCSV(MISSING_CLINT_ROW);
    expect(records).toHaveLength(1);
    // CLint_app should be a numeric value (0 or NaN depending on source type)
    expect(typeof records[0].CLint_app).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// runBatchIVIVE tests
// ---------------------------------------------------------------------------

describe('runBatchIVIVE', () => {
  it('returns one result per input record', () => {
    const records = parseIVIVECompoundCSV(VALID_ROWS);
    const results = runBatchIVIVE(records);
    expect(results).toHaveLength(2);
  });

  it('each result has speciesResults.length > 0', () => {
    const records = parseIVIVECompoundCSV(VALID_ROWS);
    const results = runBatchIVIVE(records);
    for (const r of results) {
      expect(r.results.speciesResults.length).toBeGreaterThan(0);
    }
  });

  it('result compound names match input compound names', () => {
    const records = parseIVIVECompoundCSV(VALID_ROWS);
    const results = runBatchIVIVE(records);
    expect(results[0].compound_name).toBe('Compound_A');
    expect(results[1].compound_name).toBe('Compound_B');
  });

  it('returns BatchIVIVEResult with inputs echoed back', () => {
    const records = parseIVIVECompoundCSV(VALID_ROWS);
    const results = runBatchIVIVE(records);
    expect(results[0].inputs).toEqual(records[0]);
    expect(results[1].inputs).toEqual(records[1]);
  });

  it('uses default models when modelsSelected is not provided', () => {
    const records = parseIVIVECompoundCSV(VALID_ROWS);
    const results = runBatchIVIVE(records);
    // Each species result should have model outputs for the default 3 models
    for (const r of results) {
      for (const sr of r.results.speciesResults) {
        expect(sr.modelOutputs.length).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('uses provided modelsSelected when given', () => {
    const records = parseIVIVECompoundCSV(VALID_ROWS);
    const results = runBatchIVIVE(records, undefined, ['well_stirred_no_binding']);
    for (const r of results) {
      for (const sr of r.results.speciesResults) {
        expect(sr.modelOutputs).toHaveLength(1);
        expect(sr.modelOutputs[0].model).toBe('well_stirred_no_binding');
      }
    }
  });

  it('predicted CLh is a finite positive number for valid compound', () => {
    const records = parseIVIVECompoundCSV(VALID_ROWS);
    const results = runBatchIVIVE(records, undefined, ['well_stirred_no_binding']);
    for (const r of results) {
      for (const sr of r.results.speciesResults) {
        const mo = sr.modelOutputs[0];
        expect(Number.isFinite(mo.CLh_predicted)).toBe(true);
        expect(mo.CLh_predicted).toBeGreaterThan(0);
      }
    }
  });
});
