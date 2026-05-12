/**
 * IVIVE hepatic clearance models.
 *
 * All concentrations in µM, clearance values in mL/min unless stated otherwise.
 *
 * References:
 *   Obach (1999) Drug Metab Dispos 27:1350–1359
 *   Poulin & Theil (2002) J Pharm Sci 91:129–156
 *   Houston (1994) Biochem Pharmacol 47:1469–1479
 *   Davies & Morris (1993) Pharm Res 10:1093–1095
 */

import type { IVIVEModel, IVIVEModelConfig } from '@/types';

// ---------------------------------------------------------------------------
// IVIVE MODEL CONFIGS
// ---------------------------------------------------------------------------

export const IVIVE_MODEL_CONFIGS: Record<IVIVEModel, IVIVEModelConfig> = {
  well_stirred_no_binding: {
    id: 'well_stirred_no_binding',
    label: 'Well-Stirred Model (no binding)',
    description:
      'Classic well-stirred (venous equilibration) model without explicit blood binding correction. ' +
      'Uses scaled CLint directly.',
    equations: [
      'CLh = Qh × CLint / (Qh + CLint)',
      'Eh = CLh / Qh',
    ],
    assumptions: [
      'Liver behaves as a single well-mixed compartment',
      'Unbound fraction correction not applied',
      'CLint already represents free-drug intrinsic clearance',
    ],
    requiresFuB: false,
    requiresFumic: false,
    provenance: 'Wilkinson & Shand (1975) Clin Pharmacol Ther 18:377',
  },

  well_stirred_with_binding: {
    id: 'well_stirred_with_binding',
    label: 'Well-Stirred Model (with binding)',
    description:
      'Well-stirred model incorporating blood binding (fuB = fup / BP ratio).',
    equations: [
      'fuB = fup / BP_ratio',
      'CLh = Qh × fuB × CLint / (Qh + fuB × CLint)',
      'Eh = CLh / Qh',
    ],
    assumptions: [
      'Liver behaves as a single well-mixed compartment',
      'fuB accurately reflects drug availability in blood',
    ],
    requiresFuB: true,
    requiresFumic: false,
    provenance: 'Wilkinson & Shand (1975); Obach (1999)',
  },

  parallel_tube: {
    id: 'parallel_tube',
    label: 'Parallel Tube (Venous Equilibration) Model',
    description:
      'Assumes blood flows through parallel hepatic sinusoids with uniform enzyme distribution.',
    equations: [
      'CLh = Qh × [1 − exp(−fuB × CLint / Qh)]',
      'Eh = CLh / Qh',
    ],
    assumptions: [
      'Drug distribution and elimination occur simultaneously along sinusoid length',
      'More accurate than well-stirred for high-extraction compounds',
    ],
    requiresFuB: true,
    requiresFumic: false,
    provenance: 'Pang & Rowland (1977) J Pharmacokinet Biopharm 5:625',
  },

  poulin_binding_aware: {
    id: 'poulin_binding_aware',
    label: 'Poulin Binding-Aware Method',
    description:
      'Well-stirred model variant using Kp-derived fuB (Poulin & Theil correction). ' +
      'fuB_Poulin = fup / BP_ratio.',
    equations: [
      'fuB_Poulin = fup / BP_ratio',
      'CLh = Qh × (fuB_Poulin × CLint) / (Qh + fuB_Poulin × CLint)',
    ],
    assumptions: [
      'BP ratio is used as a proxy for Kp_blood for the Poulin correction',
    ],
    requiresFuB: true,
    requiresFumic: false,
    provenance: 'Poulin & Theil (2002) J Pharm Sci 91:129',
  },

  dispersion: {
    id: 'dispersion',
    label: 'Dispersion Model',
    description:
      'Intermediate between well-stirred and parallel tube; includes axial dispersion number DN. ' +
      'DN=0 → parallel tube; DN→∞ → well-stirred.',
    equations: [
      'a = sqrt(1 + 4 × RN × DN)',
      'CLh = Qh × {1 − [4a × exp(1/(2DN))] / [(1+a)² × exp(a/(2DN)) − (1−a)² × exp(−a/(2DN))]}',
      'RN = fuB × CLint / Qh',
    ],
    assumptions: [
      'Dispersion number DN describes the degree of back-mixing (default DN=0.17 for liver)',
      'A DN of 0 gives parallel tube; DN=∞ gives well-stirred',
    ],
    requiresFuB: true,
    requiresFumic: false,
    provenance: 'Roberts & Rowland (1986) J Pharmacokinet Biopharm 14:227',
  },
};

// ---------------------------------------------------------------------------
// IN VITRO → IN VIVO CLint SCALING
// ---------------------------------------------------------------------------

/**
 * Scale microsomal CLint to whole-liver in vivo CLint.
 *
 * Formula:
 *   CLint_invivo (mL/min) = CLint_mic (µL/min/mg) × MPPGL (mg/g liver) × LW (g) / 1000
 *
 * @param CLint_mic  Apparent in vitro CLint (µL/min/mg microsomal protein)
 * @param MPPGL      Microsomal protein per gram liver (mg/g); human default 45
 * @param LW_g       Liver weight (g)
 */
export function scaleCLint_microsomal(
  CLint_mic: number,
  MPPGL: number,
  LW_g: number,
): number {
  if (MPPGL <= 0) throw new Error('scaleCLint_microsomal: MPPGL must be positive');
  if (LW_g  <= 0) throw new Error('scaleCLint_microsomal: LW_g must be positive');
  return (CLint_mic * MPPGL * LW_g) / 1000;
}

/**
 * Scale hepatocyte CLint to whole-liver in vivo CLint.
 *
 * Formula:
 *   CLint_invivo (mL/min) = CLint_hep (µL/min/10^6 cells) × HPGL (10^6 cells/g) × LW (g) / 1000
 *
 * @param CLint_hep  Apparent in vitro CLint (µL/min/10^6 hepatocytes)
 * @param HPGL       Hepatocytes per gram liver (10^6 cells/g); human default 120
 * @param LW_g       Liver weight (g)
 */
export function scaleCLint_hepatocyte(
  CLint_hep: number,
  HPGL: number,
  LW_g: number,
): number {
  if (HPGL  <= 0) throw new Error('scaleCLint_hepatocyte: HPGL must be positive');
  if (LW_g  <= 0) throw new Error('scaleCLint_hepatocyte: LW_g must be positive');
  return (CLint_hep * HPGL * LW_g) / 1000;
}

/**
 * Apply unbound-fraction correction to apparent CLint.
 *
 * CLint_u = CLint_app / fu_binding
 *
 * where fu_binding is fumic (for microsomes) or fuhep (for hepatocytes).
 *
 * @param CLint_app   Apparent CLint (any consistent unit)
 * @param fu_binding  Unbound fraction in the in vitro system (0–1)
 */
export function applyCLint_fu_correction(
  CLint_app: number,
  fu_binding: number,
): number {
  if (fu_binding <= 0 || fu_binding > 1)
    throw new Error(`applyCLint_fu_correction: fu_binding must be in (0, 1], got ${fu_binding}`);
  return CLint_app / fu_binding;
}

// ---------------------------------------------------------------------------
// HEPATIC CLEARANCE MODELS
// ---------------------------------------------------------------------------

/**
 * Well-stirred model without blood binding correction.
 *
 * CLh = Qh × CLint / (Qh + CLint)
 *
 * @param Qh_mL_min   Hepatic blood flow (mL/min)
 * @param CLint_mL_min  Scaled intrinsic clearance (mL/min)
 */
export function wellStirredNoBind(
  Qh_mL_min: number,
  CLint_mL_min: number,
): number {
  if (Qh_mL_min <= 0) throw new Error('wellStirredNoBind: Qh must be positive');
  const denom = Qh_mL_min + CLint_mL_min;
  if (denom === 0) return 0;
  return (Qh_mL_min * CLint_mL_min) / denom;
}

/**
 * Well-stirred model with blood binding correction.
 *
 * fuB = fup / BP_ratio
 * CLh = Qh × fuB × CLint / (Qh + fuB × CLint)
 *
 * @param Qh    Hepatic blood flow (mL/min)
 * @param fuB   Unbound fraction in blood (fup / BP_ratio)
 * @param CLint Scaled intrinsic clearance (mL/min)
 */
export function wellStirredWithBind(
  Qh: number,
  fuB: number,
  CLint: number,
): number {
  if (Qh  <= 0) throw new Error('wellStirredWithBind: Qh must be positive');
  if (fuB <= 0 || fuB > 1) throw new Error(`wellStirredWithBind: fuB must be in (0,1], got ${fuB}`);
  const fuBCLint = fuB * CLint;
  const denom    = Qh + fuBCLint;
  if (denom === 0) return 0;
  return (Qh * fuBCLint) / denom;
}

/**
 * Parallel tube (venous equilibration) model.
 *
 * CLh = Qh × [1 − exp(−fuB × CLint / Qh)]
 *
 * @param Qh    Hepatic blood flow (mL/min)
 * @param fuB   Unbound fraction in blood
 * @param CLint Scaled intrinsic clearance (mL/min)
 */
export function parallelTube(
  Qh: number,
  fuB: number,
  CLint: number,
): number {
  if (Qh  <= 0) throw new Error('parallelTube: Qh must be positive');
  if (fuB <= 0 || fuB > 1) throw new Error(`parallelTube: fuB must be in (0,1], got ${fuB}`);
  const exponent = -(fuB * CLint) / Qh;
  return Qh * (1 - Math.exp(exponent));
}

/**
 * Poulin binding-aware variant of the well-stirred model.
 *
 * fuB_Poulin = fup / BP_ratio
 * CLh = Qh × (fuB_Poulin × CLint) / (Qh + fuB_Poulin × CLint)
 *
 * @param Qh        Hepatic blood flow (mL/min)
 * @param fup       Unbound plasma fraction
 * @param BP_ratio  Blood-to-plasma concentration ratio
 * @param CLint     Scaled intrinsic clearance (mL/min)
 */
export function poulinMethod(
  Qh: number,
  fup: number,
  BP_ratio: number,
  CLint: number,
): number {
  if (Qh  <= 0) throw new Error('poulinMethod: Qh must be positive');
  if (BP_ratio <= 0) throw new Error('poulinMethod: BP_ratio must be positive');
  if (fup <= 0 || fup > 1) throw new Error(`poulinMethod: fup must be in (0,1], got ${fup}`);
  const fuB = fup / BP_ratio;
  return wellStirredWithBind(Qh, Math.min(fuB, 1), CLint);
}

/**
 * Dispersion model for hepatic clearance.
 *
 * Intermediate between well-stirred (DN→∞) and parallel tube (DN=0).
 * Default dispersion number DN = 0.17 for human liver.
 *
 * @param Qh    Hepatic blood flow (mL/min)
 * @param fuB   Unbound fraction in blood
 * @param CLint Scaled intrinsic clearance (mL/min)
 * @param DN    Dispersion number (default 0.17)
 */
export function dispersionModel(
  Qh: number,
  fuB: number,
  CLint: number,
  DN: number = 0.17,
): number {
  if (Qh  <= 0) throw new Error('dispersionModel: Qh must be positive');
  if (fuB <= 0 || fuB > 1) throw new Error(`dispersionModel: fuB must be in (0,1], got ${fuB}`);
  if (DN  <= 0) {
    // DN=0 → parallel tube
    return parallelTube(Qh, fuB, CLint);
  }

  const RN = (fuB * CLint) / Qh;
  const a  = Math.sqrt(1 + 4 * RN * DN);

  // Availability: F = 4a × exp(1/(2DN)) / [(1+a)² × exp(a/(2DN)) − (1−a)² × exp(−a/(2DN))]
  const inv2DN = 1 / (2 * DN);
  const numerator   = 4 * a * Math.exp(inv2DN);
  const denominator =
    (1 + a) ** 2 * Math.exp( a * inv2DN) -
    (1 - a) ** 2 * Math.exp(-a * inv2DN);

  if (denominator === 0) return Qh; // edge case
  const F_avail = numerator / denominator;
  return Qh * (1 - F_avail);
}

// ---------------------------------------------------------------------------
// EXTRACTION RATIO
// ---------------------------------------------------------------------------

/**
 * Compute hepatic extraction ratio.
 *
 * Eh = CLh / Qh
 */
export function extractionRatio(CLh: number, Qh: number): number {
  if (Qh <= 0) throw new Error('extractionRatio: Qh must be positive');
  return Math.min(1, Math.max(0, CLh / Qh));
}

/**
 * Back-calculate observed in-vivo CLint from observed CLh (well-stirred model).
 *
 * From: CLh = Qh × fuB × CLint / (Qh + fuB × CLint)
 * Solving for CLint:
 *   CLint = CLh × Qh / (fuB × (Qh − CLh))
 *
 * @param CLh_obs  Observed hepatic CL (mL/min)
 * @param Qh       Hepatic blood flow (mL/min)
 * @param fuB      Unbound fraction in blood
 */
export function backCalcCLint(
  CLh_obs: number,
  Qh: number,
  fuB: number,
): number {
  if (Qh  <= 0) throw new Error('backCalcCLint: Qh must be positive');
  if (fuB <= 0) throw new Error('backCalcCLint: fuB must be positive');
  const denom = fuB * (Qh - CLh_obs);
  if (denom <= 0) {
    throw new Error(
      `backCalcCLint: CLh_obs (${CLh_obs}) must be less than Qh (${Qh})`,
    );
  }
  return (CLh_obs * Qh) / denom;
}

/**
 * Classify hepatic extraction into low / medium / high categories.
 *
 * low:    Eh < 0.30
 * medium: 0.30 ≤ Eh ≤ 0.70
 * high:   Eh > 0.70
 */
export function categorizeExtraction(Eh: number): 'low' | 'medium' | 'high' {
  if (Eh < 0.30) return 'low';
  if (Eh > 0.70) return 'high';
  return 'medium';
}
