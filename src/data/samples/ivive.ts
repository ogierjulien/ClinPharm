// =============================================================================
// SAMPLE IVIVE DATASET — "Compound A"
// Realistic hepatic clearance IVIVE inputs for demonstration and testing
// =============================================================================

import type { IVIVEInputs } from '@/types';
import { PHYSIOLOGY_DB } from '../physiology';

const rat   = PHYSIOLOGY_DB.rat;
const dog   = PHYSIOLOGY_DB.dog;
const human = PHYSIOLOGY_DB.human;

export const IVIVE_SAMPLE: IVIVEInputs = {
  compound: {
    compound: {
      name: 'Compound A',
      id: 'cpd-A-001',
      projectCode: 'PROJ-001',
      MW: 412.5,
      logP: 2.8,
      logD: 1.9,
      pKa: 8.1,
      drugClass: 'Small molecule — neutral lipophilic',
      notes: 'Same compound as allometry sample. Metabolised primarily by CYP3A4.',
    },
    CLint_app: 85,                // µL/min/mg microsomal protein (measured in HLM)
    CLint_source: 'microsomes',
    fup: 0.08,                    // unbound fraction in human plasma
    fumic: 0.45,                  // unbound fraction in microsomal incubation (lipophilic)
    fuhep: undefined,             // not determined
    BP_ratio: 0.9,                // blood-to-plasma ratio
    apply_fumic_correction: true,
    observed_CLh: undefined,      // no observed human hepatic CL available
    CL_units: 'mL/min',
  },

  speciesData: [
    {
      species: 'rat',
      label: rat.label,
      bodyWeight_kg: rat.bodyWeight_kg,
      liverWeight_g: rat.liverWeight_g,
      MPPGL: rat.MPPGL,
      HPGL: rat.HPGL,
      Qh_mL_min: rat.hepaticBloodFlow_mL_min,
      include: true,
      overrideLiverWeight: false,
      overrideMPPGL: false,
      overrideHPGL: false,
      overrideQh: false,
    },
    {
      species: 'dog',
      label: dog.label,
      bodyWeight_kg: dog.bodyWeight_kg,
      liverWeight_g: dog.liverWeight_g,
      MPPGL: dog.MPPGL,
      HPGL: dog.HPGL,
      Qh_mL_min: dog.hepaticBloodFlow_mL_min,
      include: true,
      overrideLiverWeight: false,
      overrideMPPGL: false,
      overrideHPGL: false,
      overrideQh: false,
    },
    {
      species: 'human',
      label: human.label,
      bodyWeight_kg: human.bodyWeight_kg,
      liverWeight_g: human.liverWeight_g,
      MPPGL: human.MPPGL,
      HPGL: human.HPGL,
      Qh_mL_min: human.hepaticBloodFlow_mL_min,
      include: true,
      overrideLiverWeight: false,
      overrideMPPGL: false,
      overrideHPGL: false,
      overrideQh: false,
    },
  ],

  modelsSelected: [
    'well_stirred_no_binding',
    'well_stirred_with_binding',
    'parallel_tube',
    'poulin_binding_aware',
  ],

  CLint_units: 'µL/min/mg',
};
