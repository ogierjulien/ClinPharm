/**
 * Unit conversion utilities for clinical pharmacology calculations.
 * All functions are pure TypeScript with no browser/React dependencies.
 */

// ---------------------------------------------------------------------------
// CLEARANCE CONVERSIONS
// ---------------------------------------------------------------------------

/**
 * Convert clearance between common units.
 *
 * Supported units:
 *   'mL/min'               – absolute clearance
 *   'mL/min/kg'            – weight-normalised clearance
 *   'L/h'                  – absolute clearance
 *   'L/h/kg'               – weight-normalised clearance
 *   'µL/min/mg'            – microsomal intrinsic clearance
 *   'µL/min/10^6cells'     – hepatocyte intrinsic clearance
 *
 * Conversions between per-kg and absolute (or vice versa) require bodyWeight_kg.
 * Conversions that mix microsomal / hepatocyte units cannot be done here
 * without scaling factors; pass them through scaleMicrosomalCLint /
 * scaleHepatocyteCLint instead.
 */
export function convertCL(
  value: number,
  from: string,
  to: string,
  bodyWeight_kg?: number,
): number {
  if (from === to) return value;

  // Normalise unit strings
  const f = from.trim().toLowerCase();
  const t = to.trim().toLowerCase();

  // Helper: check if string is one of the recognised absolute units
  const isAbsolute = (u: string) =>
    u === 'ml/min' || u === 'l/h';
  const isPerKg = (u: string) =>
    u === 'ml/min/kg' || u === 'l/h/kg';

  // Convert to canonical mL/min (absolute)
  let canonical_mL_min: number;

  switch (f) {
    case 'ml/min':
      canonical_mL_min = value;
      break;
    case 'l/h':
      canonical_mL_min = value * 1000 / 60; // L/h → mL/min
      break;
    case 'ml/min/kg':
      if (bodyWeight_kg === undefined)
        throw new Error('convertCL: bodyWeight_kg required for mL/min/kg → other conversions');
      canonical_mL_min = value * bodyWeight_kg;
      break;
    case 'l/h/kg':
      if (bodyWeight_kg === undefined)
        throw new Error('convertCL: bodyWeight_kg required for L/h/kg → other conversions');
      canonical_mL_min = value * bodyWeight_kg * 1000 / 60;
      break;
    // Microsomal / hepatocyte units — cannot convert without scaling params
    case 'µl/min/mg':
    case 'ul/min/mg':
      canonical_mL_min = value / 1000; // µL → mL, per-mg stays as-is (incomplete scaling)
      break;
    case 'µl/min/10^6cells':
    case 'ul/min/10^6cells':
      canonical_mL_min = value / 1000;
      break;
    default:
      throw new Error(`convertCL: unsupported 'from' unit "${from}"`);
  }

  // Convert from canonical mL/min to target
  switch (t) {
    case 'ml/min':
      return canonical_mL_min;
    case 'l/h':
      return canonical_mL_min * 60 / 1000;
    case 'ml/min/kg':
      if (bodyWeight_kg === undefined)
        throw new Error('convertCL: bodyWeight_kg required for → mL/min/kg conversions');
      return canonical_mL_min / bodyWeight_kg;
    case 'l/h/kg':
      if (bodyWeight_kg === undefined)
        throw new Error('convertCL: bodyWeight_kg required for → L/h/kg conversions');
      return (canonical_mL_min * 60 / 1000) / bodyWeight_kg;
    case 'µl/min/mg':
    case 'ul/min/mg':
      return canonical_mL_min * 1000;
    case 'µl/min/10^6cells':
    case 'ul/min/10^6cells':
      return canonical_mL_min * 1000;
    default:
      throw new Error(`convertCL: unsupported 'to' unit "${to}"`);
  }
}

// ---------------------------------------------------------------------------
// VOLUME OF DISTRIBUTION CONVERSIONS
// ---------------------------------------------------------------------------

/**
 * Convert volume of distribution between L, L/kg, mL, mL/kg.
 */
export function convertVss(
  value: number,
  from: string,
  to: string,
  bodyWeight_kg?: number,
): number {
  if (from === to) return value;

  const f = from.trim().toLowerCase();
  const t = to.trim().toLowerCase();

  // Convert to canonical Litres (absolute)
  let canonical_L: number;

  switch (f) {
    case 'l':
      canonical_L = value;
      break;
    case 'ml':
      canonical_L = value / 1000;
      break;
    case 'l/kg':
      if (bodyWeight_kg === undefined)
        throw new Error('convertVss: bodyWeight_kg required for L/kg → other conversions');
      canonical_L = value * bodyWeight_kg;
      break;
    case 'ml/kg':
      if (bodyWeight_kg === undefined)
        throw new Error('convertVss: bodyWeight_kg required for mL/kg → other conversions');
      canonical_L = value * bodyWeight_kg / 1000;
      break;
    default:
      throw new Error(`convertVss: unsupported 'from' unit "${from}"`);
  }

  switch (t) {
    case 'l':
      return canonical_L;
    case 'ml':
      return canonical_L * 1000;
    case 'l/kg':
      if (bodyWeight_kg === undefined)
        throw new Error('convertVss: bodyWeight_kg required for → L/kg conversions');
      return canonical_L / bodyWeight_kg;
    case 'ml/kg':
      if (bodyWeight_kg === undefined)
        throw new Error('convertVss: bodyWeight_kg required for → mL/kg conversions');
      return (canonical_L * 1000) / bodyWeight_kg;
    default:
      throw new Error(`convertVss: unsupported 'to' unit "${to}"`);
  }
}

// ---------------------------------------------------------------------------
// CONCENTRATION CONVERSIONS
// ---------------------------------------------------------------------------

/**
 * Convert concentration values.
 * MW (g/mol) is required when converting between molar and mass-based units.
 *
 * Supported units: 'µM', 'nM', 'ng/mL', 'µg/mL', 'mg/L'
 */
export function convertConc(
  value: number,
  from: string,
  to: string,
  MW?: number,
): number {
  if (from === to) return value;

  const f = from.trim();
  const t = to.trim();

  // Canonical unit: µM
  let canonical_uM: number;

  switch (f) {
    case 'µM':
    case 'uM':
      canonical_uM = value;
      break;
    case 'nM':
      canonical_uM = value / 1000;
      break;
    case 'ng/mL':
      // ng/mL = µg/L; convert to µM: (ng/mL) / MW × 1000  [since µg/mL / MW(g/mol) = µmol/mL = µM × 1000]
      // actually: ng/mL = µg/L → µg/mL = ng/mL / 1000
      // µM = (µg/mL) / MW × 1000 = (ng/mL / 1000) / MW × 1000 = ng/mL / MW
      if (MW === undefined || MW <= 0)
        throw new Error('convertConc: MW (g/mol) required for ng/mL ↔ molar conversions');
      canonical_uM = value / MW; // ng/mL / (g/mol) = nmol/mL × 1 = nM → /1000 = µM … wait:
      // ng/mL = (ng/mL) ÷ MW(g/mol) × 1000 = nmol/L = nM → /1000 µM
      // So: canonical_uM = (value / MW) / 1000
      canonical_uM = value / (MW * 1000);
      break;
    case 'µg/mL':
    case 'ug/mL':
      if (MW === undefined || MW <= 0)
        throw new Error('convertConc: MW (g/mol) required for µg/mL ↔ molar conversions');
      // µg/mL = mg/L;  µM = (mg/L) / MW × 1000 = µg/mL / MW × 1000
      // Actually: µg/mL ÷ MW(g/mol) × 1e3 = µmol/mL = µM × 1e3 → wrong
      // µg/mL = µmol/L × MW(g/mol) / 1000  ← because 1 µmol/L × MW g/mol = MW µg/L = MW/1000 µg/mL
      // Therefore µM = (µg/mL × 1000) / MW
      canonical_uM = (value * 1000) / MW;
      break;
    case 'mg/L':
      // mg/L = µg/mL
      if (MW === undefined || MW <= 0)
        throw new Error('convertConc: MW (g/mol) required for mg/L ↔ molar conversions');
      canonical_uM = (value * 1000) / MW;
      break;
    default:
      throw new Error(`convertConc: unsupported 'from' unit "${from}"`);
  }

  switch (t) {
    case 'µM':
    case 'uM':
      return canonical_uM;
    case 'nM':
      return canonical_uM * 1000;
    case 'ng/mL':
      if (MW === undefined || MW <= 0)
        throw new Error('convertConc: MW (g/mol) required for → ng/mL conversions');
      return canonical_uM * MW * 1000;
    case 'µg/mL':
    case 'ug/mL':
      if (MW === undefined || MW <= 0)
        throw new Error('convertConc: MW (g/mol) required for → µg/mL conversions');
      return (canonical_uM * MW) / 1000;
    case 'mg/L':
      if (MW === undefined || MW <= 0)
        throw new Error('convertConc: MW (g/mol) required for → mg/L conversions');
      return (canonical_uM * MW) / 1000;
    default:
      throw new Error(`convertConc: unsupported 'to' unit "${to}"`);
  }
}

// ---------------------------------------------------------------------------
// PER-KG ↔ ABSOLUTE NORMALISATION
// ---------------------------------------------------------------------------

/**
 * Normalise per-kg CL to absolute CL.
 * @param CL_perKg  mL/min/kg
 * @param BW_kg     body weight (kg)
 * @returns absolute CL (mL/min)
 */
export function normalizeToAbsolute_CL(CL_perKg: number, BW_kg: number): number {
  if (BW_kg <= 0) throw new Error('normalizeToAbsolute_CL: BW_kg must be positive');
  return CL_perKg * BW_kg;
}

/**
 * Normalise absolute CL to per-kg CL.
 * @param CL_abs  mL/min
 * @param BW_kg   body weight (kg)
 * @returns CL per kg (mL/min/kg)
 */
export function normalizeToPerKg_CL(CL_abs: number, BW_kg: number): number {
  if (BW_kg <= 0) throw new Error('normalizeToPerKg_CL: BW_kg must be positive');
  return CL_abs / BW_kg;
}

// ---------------------------------------------------------------------------
// IN VITRO → IN VIVO CLint SCALING
// ---------------------------------------------------------------------------

/**
 * Scale microsomal CLint (µL/min/mg protein) to in vivo intrinsic clearance (mL/min).
 *
 * Formula:
 *   CLint_invivo (mL/min) = CLint_mic (µL/min/mg) × MPPGL (mg/g liver) × LW (g) / 1000
 *
 * The division by 1000 converts µL → mL.
 *
 * @param CLint_mic_uL_min_mg  in vitro CLint from microsomal incubation (µL/min/mg protein)
 * @param MPPGL                microsomal protein per gram liver (mg/g liver)
 *                             Human default: 45 mg/g
 * @param liverWeight_g        liver weight (g)
 * @returns in vivo CLint (mL/min)
 */
export function scaleMicrosomalCLint(
  CLint_mic_uL_min_mg: number,
  MPPGL: number,
  liverWeight_g: number,
): number {
  if (MPPGL <= 0) throw new Error('scaleMicrosomalCLint: MPPGL must be positive');
  if (liverWeight_g <= 0) throw new Error('scaleMicrosomalCLint: liverWeight_g must be positive');
  return (CLint_mic_uL_min_mg * MPPGL * liverWeight_g) / 1000;
}

/**
 * Scale hepatocyte CLint (µL/min/10^6 cells) to in vivo intrinsic clearance (mL/min).
 *
 * Formula:
 *   CLint_invivo (mL/min) = CLint_hep (µL/min/10^6 cells) × HPGL (10^6 cells/g) × LW (g) / 1000
 *
 * @param CLint_hep_uL_min_M  in vitro CLint from hepatocyte incubation (µL/min/10^6 cells)
 * @param HPGL                hepatocytes per gram liver (10^6 cells/g liver)
 *                            Human default: 120 × 10^6 cells/g
 * @param liverWeight_g       liver weight (g)
 * @returns in vivo CLint (mL/min)
 */
export function scaleHepatocyteCLint(
  CLint_hep_uL_min_M: number,
  HPGL: number,
  liverWeight_g: number,
): number {
  if (HPGL <= 0) throw new Error('scaleHepatocyteCLint: HPGL must be positive');
  if (liverWeight_g <= 0) throw new Error('scaleHepatocyteCLint: liverWeight_g must be positive');
  return (CLint_hep_uL_min_M * HPGL * liverWeight_g) / 1000;
}
