/**
 * Michaelis-Menten enzyme kinetics — in-vitro CLint derivation.
 *
 * ICH M12 (2024) Section 3: In-vitro characterisation of metabolising enzymes.
 * FDA (2020) Guidance for Industry: In vitro drug interaction studies.
 *
 * At substrate concentrations substantially below Km (linear range):
 *   CLint = Vmax / Km
 *
 * At any substrate concentration [S]:
 *   v = (Vmax × [S]) / (Km + [S])
 *   CLint = v / [S] = Vmax / (Km + [S])
 *
 * Units:
 *   Microsomes:   Vmax (pmol/min/mg), Km (µM) → CLint (µL/min/mg protein)
 *   Hepatocytes:  Vmax (pmol/min/10^6 cells), Km (µM) → CLint (µL/min/10^6 cells)
 */

import type { MMKineticsEntry } from '@/types';

// ---------------------------------------------------------------------------
// CORE CALCULATIONS
// ---------------------------------------------------------------------------

/**
 * Intrinsic clearance from Vmax and Km (linear approximation, [S] << Km).
 *
 * CLint = Vmax / Km
 *
 * @param Vmax  Maximum reaction velocity (pmol/min/mg or pmol/min/10^6 cells)
 * @param Km    Michaelis constant (µM)
 * @returns     CLint (µL/min/mg or µL/min/10^6 cells)
 */
export function CLint_linear(Vmax: number, Km: number): number {
  if (Km <= 0) throw new Error(`CLint_linear: Km must be positive, got ${Km}`);
  if (Vmax < 0) throw new Error(`CLint_linear: Vmax must be non-negative, got ${Vmax}`);
  return Vmax / Km;
}

/**
 * Intrinsic clearance corrected for substrate concentration.
 *
 * CLint = Vmax / (Km + [S])
 *
 * Use this when the substrate concentration used in the assay is not
 * negligible relative to Km.
 *
 * @param Vmax            Maximum reaction velocity
 * @param Km              Michaelis constant (µM)
 * @param substrate_conc  Substrate concentration in assay (µM)
 * @returns               CLint (same units as Vmax/Km)
 */
export function CLint_corrected(Vmax: number, Km: number, substrate_conc: number): number {
  if (Km <= 0) throw new Error(`CLint_corrected: Km must be positive, got ${Km}`);
  if (substrate_conc < 0) throw new Error('CLint_corrected: substrate_conc must be ≥ 0');
  return Vmax / (Km + substrate_conc);
}

/**
 * Michaelis-Menten velocity at a given substrate concentration.
 *
 * v = (Vmax × [S]) / (Km + [S])
 *
 * @param Vmax            Maximum reaction velocity
 * @param Km              Michaelis constant (µM)
 * @param substrate_conc  Substrate concentration (µM)
 * @returns               Reaction velocity (same units as Vmax)
 */
export function MM_velocity(Vmax: number, Km: number, substrate_conc: number): number {
  if (Km <= 0) throw new Error('MM_velocity: Km must be positive');
  if (substrate_conc < 0) throw new Error('MM_velocity: substrate_conc must be ≥ 0');
  return (Vmax * substrate_conc) / (Km + substrate_conc);
}

// ---------------------------------------------------------------------------
// BATCH DERIVATION
// ---------------------------------------------------------------------------

/**
 * Derive CLint for each entry in an MMKineticsEntry array.
 *
 * If substrate_conc is provided and > Km/10 (i.e., not negligible),
 * uses the corrected formula; otherwise uses the linear approximation.
 *
 * Returns a new array with CLint_derived populated.
 */
export function deriveMMCLint(entries: MMKineticsEntry[]): MMKineticsEntry[] {
  return entries.map(entry => {
    const { Km, Vmax, substrate_conc } = entry;

    if (!Km || !Vmax || Km <= 0 || Vmax < 0) {
      return { ...entry, CLint_derived: undefined };
    }

    let CLint: number;
    if (substrate_conc !== undefined && substrate_conc > 0) {
      CLint = CLint_corrected(Vmax, Km, substrate_conc);
    } else {
      CLint = CLint_linear(Vmax, Km);
    }

    return { ...entry, CLint_derived: CLint };
  });
}

// ---------------------------------------------------------------------------
// MM CURVE DATA (for plotting)
// ---------------------------------------------------------------------------

/**
 * Generate Michaelis-Menten curve data points for plotting.
 *
 * Returns [S] values from 0 to 10×Km and corresponding velocities.
 */
export function MMCurveData(
  Vmax: number,
  Km: number,
  nPoints = 100,
): { S: number[]; v: number[] } {
  const Smax = 10 * Km;
  const step = Smax / (nPoints - 1);
  const S: number[] = [];
  const v: number[] = [];

  for (let i = 0; i < nPoints; i++) {
    const s = i * step;
    S.push(s);
    v.push(MM_velocity(Vmax, Km, s));
  }
  return { S, v };
}
