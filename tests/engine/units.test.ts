import { describe, it, expect } from 'vitest';
import {
  convertCL,
  convertVss,
  normalizeToAbsolute_CL,
  normalizeToPerKg_CL,
  scaleMicrosomalCLint,
  scaleHepatocyteCLint,
} from '@/engine/units';

describe('convertCL', () => {
  it('mL/min → L/h: ×0.06', () => {
    expect(convertCL(1000, 'mL/min', 'L/h')).toBeCloseTo(60.0, 4);
  });

  it('L/h → mL/min: ÷0.06', () => {
    expect(convertCL(60, 'L/h', 'mL/min')).toBeCloseTo(1000.0, 4);
  });

  it('identity conversion', () => {
    expect(convertCL(100, 'mL/min', 'mL/min')).toBe(100);
  });
});

describe('convertVss', () => {
  it('L → mL: ×1000', () => {
    expect(convertVss(5, 'L', 'mL')).toBe(5000);
  });

  it('L/kg at 70kg → L', () => {
    // This tests normalizeToAbsolute_CL which uses Vss ×BW
    expect(normalizeToAbsolute_CL(10, 70)).toBe(700);
  });
});

describe('normalizeToAbsolute_CL', () => {
  it('CL_abs = CL_perKg × BW', () => {
    expect(normalizeToAbsolute_CL(20, 0.25)).toBeCloseTo(5.0, 6);
  });
});

describe('normalizeToPerKg_CL', () => {
  it('CL_perKg = CL_abs / BW', () => {
    expect(normalizeToPerKg_CL(5, 0.25)).toBeCloseTo(20.0, 6);
  });

  it('is inverse of normalizeToAbsolute', () => {
    const BW = 11.3;
    const CL_abs = 113;
    const perKg = normalizeToPerKg_CL(CL_abs, BW);
    expect(normalizeToAbsolute_CL(perKg, BW)).toBeCloseTo(CL_abs, 4);
  });
});

describe('scaleMicrosomalCLint', () => {
  it('CLint_invivo = CLint_mic × MPPGL × LW / 1000', () => {
    // 85 µL/min/mg × 45 mg/g × 1800g ÷ 1000 = 6885 mL/min
    const result = scaleMicrosomalCLint(85, 45, 1800);
    expect(result).toBeCloseTo(6885, 0);
  });

  it('zero CLint → zero result', () => {
    expect(scaleMicrosomalCLint(0, 45, 1800)).toBe(0);
  });

  it('scales linearly with CLint_mic', () => {
    const base = scaleMicrosomalCLint(50, 45, 1800);
    const double = scaleMicrosomalCLint(100, 45, 1800);
    expect(double / base).toBeCloseTo(2.0, 5);
  });
});

describe('scaleHepatocyteCLint', () => {
  it('CLint_invivo = CLint_hep × HPGL × LW / 1000', () => {
    // 5 µL/min/10^6cells × 120 ×10^6cells/g × 1800g ÷ 1000 = 1080 mL/min
    const result = scaleHepatocyteCLint(5, 120, 1800);
    expect(result).toBeCloseTo(1080, 0);
  });
});
