// =============================================================================
// SAMPLE DDI DATASET — "Compound B"
// Realistic DDI inputs: reversible inhibitor, TDI perpetrator, and substrate
// =============================================================================

import type { DDIInputs } from '@/types';
import { PHYSIOLOGY_DB } from '../physiology';

const human = PHYSIOLOGY_DB.human;

export const DDI_SAMPLE: DDIInputs = {
  compound: {
    name: 'Compound B',
    id: 'cpd-B-002',
    projectCode: 'PROJ-002',
    MW: 385.4,
    logP: 3.1,
    logD: 2.5,
    pKa: 9.2,
    drugClass: 'Small molecule — basic amine',
    notes:
      'Compound B is both a CYP substrate and a CYP inhibitor. ' +
      'Reversible inhibition of CYP3A4 and CYP2D6; TDI of CYP3A4. ' +
      'P-gp inhibitor. Cmax_unbound 0.5 µM at therapeutic dose.',
  },

  // -------------------------------------------------------------------------
  // Substrate pathways
  // -------------------------------------------------------------------------
  substratePathways: [
    {
      enzyme: 'CYP3A4',
      fm: 0.65,
      isSensitive: false,
      isMajor: true,
    },
    {
      enzyme: 'CYP2D6',
      fm: 0.20,
      isSensitive: false,
      isMajor: false,
    },
    {
      enzyme: 'other',
      fm: 0.15,       // renal + non-CYP pathways
      isSensitive: false,
      isMajor: false,
    },
  ],

  // -------------------------------------------------------------------------
  // Reversible inhibition
  // -------------------------------------------------------------------------
  reversibleInhibitors: [
    {
      enzyme: 'CYP3A4',
      Ki: 2.5,                    // µM (unbound, competitive)
      IC50: 5.0,                  // µM
      Iu_max: 0.5,                // µM (unbound systemic Cmax)
      Iu_inlet: 3.2,              // µM (estimated hepatic inlet: Iu_max + Fa×Dose/(Qh×τ))
      mechanism: 'competitive',
      IC50_to_Ki_ratio: 2,
    },
    {
      enzyme: 'CYP2D6',
      Ki: 8.0,                    // µM
      IC50: 16.0,                 // µM
      Iu_max: 0.5,                // µM
      Iu_inlet: 3.2,              // µM
      mechanism: 'competitive',
      IC50_to_Ki_ratio: 2,
    },
  ],

  // -------------------------------------------------------------------------
  // Time-dependent inhibition (TDI / MBI)
  // -------------------------------------------------------------------------
  tdiData: [
    {
      enzyme: 'CYP3A4',
      kinact: 1.2,                // h⁻¹ (maximum inactivation rate)
      KI: 0.8,                    // µM (concentration at half-maximal kinact)
      Iu_max: 0.5,                // µM
      kdeg: human.kdeg_CYP3A4 ?? 0.0193,  // h⁻¹ (from physiology DB)
      source: 'In-house TDI assay, pooled HLM, n=3 experiments',
    },
  ],

  // -------------------------------------------------------------------------
  // Induction (no induction observed at therapeutic concentrations)
  // -------------------------------------------------------------------------
  induction: [],

  // -------------------------------------------------------------------------
  // Transporter inhibition
  // -------------------------------------------------------------------------
  transporterInhibition: [
    {
      transporter: 'P-gp',
      IC50: 5.0,                  // µM (bidirectional Caco-2 assay)
      Ki: undefined,
      Iu_gut: 20.0,               // µM (estimated gut lumen: dose 200 mg / 250 mL = ~2 µmol/250 mL ×1000 → simplified)
      Iu_systemic: 0.5,           // µM (unbound systemic)
      threshold_R: 10,            // EMA P-gp intestinal threshold
      threshold_concentration: undefined,
    },
  ],

  // -------------------------------------------------------------------------
  // Concentration data
  // -------------------------------------------------------------------------
  Cmax_total: 6.25,               // µM total plasma Cmax
  fup: 0.08,                      // unbound fraction → Cmax_unbound = 6.25 × 0.08 = 0.5 µM
  Cmax_unbound: 0.5,              // µM (= Cmax_total × fup)
  dose_mg: 200,
  bioavailability_F: 0.55,
  dosingInterval_h: 24,
  useInletConcentration: true,
  fabs: 0.85,                     // fraction absorbed
  Qgut_mL_min: 18,                // gut blood flow (mL/min, EMA/FDA default)
};
