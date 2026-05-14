// =============================================================================
// SAMPLE IVIVE DATASET — "Compound A"
// Realistic hepatic clearance IVIVE inputs for demonstration and testing
// =============================================================================

import type { IVIVEInputs } from '@/types';
import { PHYSIOLOGY_DB } from '../physiology';

const mouse   = PHYSIOLOGY_DB.mouse;
const rat     = PHYSIOLOGY_DB.rat;
const rabbit  = PHYSIOLOGY_DB.rabbit;
const minipig = PHYSIOLOGY_DB.minipig;
const dog     = PHYSIOLOGY_DB.dog;
const monkey  = PHYSIOLOGY_DB.monkey;
const human   = PHYSIOLOGY_DB.human;

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
    CLint_app: 85,                // µL/min/mg microsomal protein (human reference)
    CLint_source: 'microsomes',
    fup: 0.08,                    // unbound fraction in human plasma
    fumic: 0.45,                  // unbound fraction in microsomal incubation (lipophilic)
    fuhep: undefined,
    BP_ratio: 0.9,                // blood-to-plasma ratio
    apply_fumic_correction: true,
    observed_CLh: undefined,
    CL_units: 'mL/min',
  },

  perSpeciesCompound: [
    { species: 'mouse',   CLint_app: 210, fup: 0.12, BP_ratio: 0.85, observed_CLh: undefined },
    { species: 'rat',     CLint_app: 145, fup: 0.10, BP_ratio: 0.88, observed_CLh: undefined },
    { species: 'rabbit',  CLint_app: 110, fup: 0.09, BP_ratio: 0.92, observed_CLh: undefined },
    { species: 'minipig', CLint_app:  95, fup: 0.09, BP_ratio: 0.90, observed_CLh: undefined },
    { species: 'dog',     CLint_app: 120, fup: 0.10, BP_ratio: 0.91, observed_CLh: undefined },
    { species: 'monkey',  CLint_app:  98, fup: 0.09, BP_ratio: 0.91, observed_CLh: undefined },
    { species: 'human',   CLint_app:  85, fup: 0.08, BP_ratio: 0.90, observed_CLh: undefined },
  ],

  speciesData: [
    {
      species: 'mouse',
      label: mouse.label,
      bodyWeight_kg: mouse.bodyWeight_kg,
      liverWeight_g: mouse.liverWeight_g,
      MPPGL: mouse.MPPGL,
      HPGL: mouse.HPGL,
      Qh_mL_min: mouse.hepaticBloodFlow_mL_min,
      include: true,
      overrideLiverWeight: false,
      overrideMPPGL: false,
      overrideHPGL: false,
      overrideQh: false,
    },
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
      species: 'rabbit',
      label: rabbit.label,
      bodyWeight_kg: rabbit.bodyWeight_kg,
      liverWeight_g: rabbit.liverWeight_g,
      MPPGL: rabbit.MPPGL,
      HPGL: rabbit.HPGL,
      Qh_mL_min: rabbit.hepaticBloodFlow_mL_min,
      include: true,
      overrideLiverWeight: false,
      overrideMPPGL: false,
      overrideHPGL: false,
      overrideQh: false,
    },
    {
      species: 'minipig',
      label: minipig.label,
      bodyWeight_kg: minipig.bodyWeight_kg,
      liverWeight_g: minipig.liverWeight_g,
      MPPGL: minipig.MPPGL,
      HPGL: minipig.HPGL,
      Qh_mL_min: minipig.hepaticBloodFlow_mL_min,
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
      species: 'monkey',
      label: monkey.label,
      bodyWeight_kg: monkey.bodyWeight_kg,
      liverWeight_g: monkey.liverWeight_g,
      MPPGL: monkey.MPPGL,
      HPGL: monkey.HPGL,
      Qh_mL_min: monkey.hepaticBloodFlow_mL_min,
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
