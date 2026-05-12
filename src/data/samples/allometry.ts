// =============================================================================
// SAMPLE ALLOMETRY DATASET — "Compound A"
// Realistic DMPK values for demonstration and testing purposes
// =============================================================================

import type { AllometryInputs } from '@/types';
import { PHYSIOLOGY_DB } from '../physiology';

export const ALLOMETRY_SAMPLE: AllometryInputs = {
  compound: {
    name: 'Compound A',
    id: 'cpd-A-001',
    projectCode: 'PROJ-001',
    MW: 412.5,
    logP: 2.8,
    logD: 1.9,
    pKa: 8.1,
    drugClass: 'Small molecule — neutral lipophilic',
    notes: 'Fictional compound for allometry demonstration. Primarily hepatically cleared.',
  },

  animalData: [
    {
      id: 'mouse-001',
      species: 'mouse',
      label: 'Mouse',
      bodyWeight_kg: 0.02,
      CL_observed: 1.2,          // mL/min absolute (60 mL/min/kg × 0.02 kg)
      Vss_observed: 0.03,         // L absolute (1.5 L/kg × 0.02 kg)
      fup: 0.12,
      brainWeight_g: PHYSIOLOGY_DB.mouse.brainWeight_g,
      MLP_years: PHYSIOLOGY_DB.mouse.MLP_years,
      include: true,
      CL_perKg_input: false,
      Vss_perKg_input: false,
      CL_abs: 1.2,
      Vss_abs: 0.03,
    },
    {
      id: 'rat-001',
      species: 'rat',
      label: 'Rat',
      bodyWeight_kg: 0.25,
      CL_observed: 7.5,           // mL/min absolute (30 mL/min/kg × 0.25 kg)
      Vss_observed: 0.30,          // L absolute (1.2 L/kg × 0.25 kg)
      fup: 0.10,
      brainWeight_g: PHYSIOLOGY_DB.rat.brainWeight_g,
      MLP_years: PHYSIOLOGY_DB.rat.MLP_years,
      include: true,
      CL_perKg_input: false,
      Vss_perKg_input: false,
      CL_abs: 7.5,
      Vss_abs: 0.30,
    },
    {
      id: 'dog-001',
      species: 'dog',
      label: 'Dog (Beagle)',
      bodyWeight_kg: 11.3,
      CL_observed: 113.0,         // mL/min absolute (10 mL/min/kg × 11.3 kg)
      Vss_observed: 10.17,         // L absolute (0.9 L/kg × 11.3 kg)
      fup: 0.15,
      brainWeight_g: PHYSIOLOGY_DB.dog.brainWeight_g,
      MLP_years: PHYSIOLOGY_DB.dog.MLP_years,
      include: true,
      CL_perKg_input: false,
      Vss_perKg_input: false,
      CL_abs: 113.0,
      Vss_abs: 10.17,
    },
    {
      id: 'monkey-001',
      species: 'monkey',
      label: 'Rhesus Monkey',
      bodyWeight_kg: 5.0,
      CL_observed: 75.0,          // mL/min absolute (15 mL/min/kg × 5.0 kg)
      Vss_observed: 5.50,          // L absolute (1.1 L/kg × 5.0 kg)
      fup: 0.11,
      brainWeight_g: PHYSIOLOGY_DB.monkey.brainWeight_g,
      MLP_years: PHYSIOLOGY_DB.monkey.MLP_years,
      include: true,
      CL_perKg_input: false,
      Vss_perKg_input: false,
      CL_abs: 75.0,
      Vss_abs: 5.50,
    },
    {
      id: 'cyno-001',
      species: 'cynomolgus_monkey',
      label: 'Cynomolgus Monkey',
      bodyWeight_kg: 4.0,
      CL_observed: 72.0,          // mL/min absolute (18 mL/min/kg × 4.0 kg)
      Vss_observed: 4.80,          // L absolute (1.2 L/kg × 4.0 kg)
      fup: 0.11,
      brainWeight_g: PHYSIOLOGY_DB.cynomolgus_monkey.brainWeight_g,
      MLP_years: PHYSIOLOGY_DB.cynomolgus_monkey.MLP_years,
      include: true,
      CL_perKg_input: false,
      Vss_perKg_input: false,
      CL_abs: 72.0,
      Vss_abs: 4.80,
    },
  ],

  humanBodyWeight_kg: 70,
  humanFup: 0.08,
  humanBrainWeight_g: PHYSIOLOGY_DB.human.brainWeight_g,
  humanMLP_years: PHYSIOLOGY_DB.human.MLP_years,

  methodsSelected: [
    'simple',
    'unbound_fraction',
    'MLP',
    'rule_of_exponent',
    'caldwell_tang_1',
  ],

  predictCL: true,
  predictVss: true,
  predictHalfLife: true,
  regressionWeighted: false,

  CL_units: 'mL/min',
  Vss_units: 'L',
  BW_units: 'kg',
};
