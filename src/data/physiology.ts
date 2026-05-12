// =============================================================================
// PHYSIOLOGY DATABASE — species physiological parameters for DMPK calculations
// All values from published DMPK literature (Davies & Morris 1993, Boxenbaum 1982,
// Shima et al. 2010, Houston & Carlile 1997, Barter et al. 2007)
// =============================================================================

import type { Species, SpeciesPhysiology } from '@/types';

export const PHYSIOLOGY_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Default kdeg values for human CYPs (h⁻¹)
// Source: Yang et al. 2008 DMD; Nishimura et al. 2003 Pharmacogenetics
// ---------------------------------------------------------------------------
const HUMAN_CYP_KDEG = {
  kdeg_CYP3A4:  0.0193,
  kdeg_CYP2D6:  0.0088,
  kdeg_CYP2C9:  0.0148,
  kdeg_CYP2C19: 0.0148,
  kdeg_CYP1A2:  0.0208,
  kdeg_CYP2B6:  0.0096,
  kdeg_CYP2C8:  0.0213,
} as const;

// Default kdeg for non-human species (h⁻¹) — literature default where species-specific
// data are unavailable (Fahmi et al. 2009 DMD)
const DEFAULT_NONHUMAN_KDEG = {
  kdeg_CYP1A2:  0.03,
  kdeg_CYP2B6:  0.03,
  kdeg_CYP2C8:  0.03,
  kdeg_CYP2C9:  0.03,
  kdeg_CYP2C19: 0.03,
  kdeg_CYP2D6:  0.03,
  kdeg_CYP3A4:  0.03,
} as const;

// ---------------------------------------------------------------------------
// Main physiology database
// ---------------------------------------------------------------------------
export const PHYSIOLOGY_DB: Record<Species, SpeciesPhysiology> = {
  mouse: {
    species: 'mouse',
    label: 'Mouse',
    bodyWeight_kg: 0.02,
    liverWeight_g: 1.0,
    liverWeight_fraction: 0.055,
    MPPGL: 45,
    HPGL: 135,
    hepaticBloodFlow_mL_min: 1.8,
    hepaticBloodFlow_mL_min_kg: 90.0,
    brainWeight_g: 0.42,
    MLP_years: 3.5,
    plasmaProtein_g_L: 60,
    RBC_L_L: 0.45,
    fumic_default: 1.0,
    fuhep_default: 1.0,
    ...DEFAULT_NONHUMAN_KDEG,
  },

  rat: {
    species: 'rat',
    label: 'Rat',
    bodyWeight_kg: 0.25,
    liverWeight_g: 10.0,
    liverWeight_fraction: 0.040,
    MPPGL: 45,
    HPGL: 117,
    hepaticBloodFlow_mL_min: 13.8,
    hepaticBloodFlow_mL_min_kg: 55.2,
    brainWeight_g: 2.0,
    MLP_years: 4.7,
    plasmaProtein_g_L: 60,
    RBC_L_L: 0.46,
    fumic_default: 1.0,
    fuhep_default: 1.0,
    ...DEFAULT_NONHUMAN_KDEG,
  },

  rabbit: {
    species: 'rabbit',
    label: 'Rabbit',
    bodyWeight_kg: 2.0,
    liverWeight_g: 77.0,
    liverWeight_fraction: 0.039,
    MPPGL: 45,
    HPGL: 130,
    hepaticBloodFlow_mL_min: 75.3,
    hepaticBloodFlow_mL_min_kg: 37.7,
    brainWeight_g: 9.5,
    MLP_years: 13.0,
    plasmaProtein_g_L: 60,
    RBC_L_L: 0.40,
    fumic_default: 1.0,
    fuhep_default: 1.0,
    ...DEFAULT_NONHUMAN_KDEG,
  },

  guinea_pig: {
    species: 'guinea_pig',
    label: 'Guinea Pig',
    bodyWeight_kg: 0.4,
    liverWeight_g: 16.0,
    liverWeight_fraction: 0.040,
    MPPGL: 45,
    HPGL: 130,
    hepaticBloodFlow_mL_min: 16.6,
    hepaticBloodFlow_mL_min_kg: 41.5,
    brainWeight_g: 3.8,
    MLP_years: 7.5,
    plasmaProtein_g_L: 55,
    RBC_L_L: 0.43,
    fumic_default: 1.0,
    fuhep_default: 1.0,
    ...DEFAULT_NONHUMAN_KDEG,
  },

  hamster: {
    species: 'hamster',
    label: 'Hamster',
    bodyWeight_kg: 0.11,
    liverWeight_g: 4.2,
    liverWeight_fraction: 0.038,
    MPPGL: 45,
    HPGL: 120,
    hepaticBloodFlow_mL_min: 6.0,
    hepaticBloodFlow_mL_min_kg: 54.5,
    brainWeight_g: 1.0,
    MLP_years: 3.9,
    plasmaProtein_g_L: 58,
    RBC_L_L: 0.45,
    fumic_default: 1.0,
    fuhep_default: 1.0,
    ...DEFAULT_NONHUMAN_KDEG,
  },

  dog: {
    species: 'dog',
    label: 'Dog (Beagle)',
    bodyWeight_kg: 11.3,
    liverWeight_g: 309.0,
    liverWeight_fraction: 0.027,
    MPPGL: 52,
    HPGL: 215,
    hepaticBloodFlow_mL_min: 309.0,
    hepaticBloodFlow_mL_min_kg: 27.3,
    brainWeight_g: 72.0,
    MLP_years: 20.0,
    plasmaProtein_g_L: 60,
    RBC_L_L: 0.45,
    fumic_default: 1.0,
    fuhep_default: 1.0,
    ...DEFAULT_NONHUMAN_KDEG,
  },

  monkey: {
    species: 'monkey',
    label: 'Rhesus Monkey',
    bodyWeight_kg: 5.0,
    liverWeight_g: 100.0,
    liverWeight_fraction: 0.020,
    MPPGL: 52,
    HPGL: 135,
    hepaticBloodFlow_mL_min: 140.0,
    hepaticBloodFlow_mL_min_kg: 28.0,
    brainWeight_g: 87.0,
    MLP_years: 40.0,
    plasmaProtein_g_L: 72,
    RBC_L_L: 0.42,
    fumic_default: 1.0,
    fuhep_default: 1.0,
    ...DEFAULT_NONHUMAN_KDEG,
  },

  cynomolgus_monkey: {
    species: 'cynomolgus_monkey',
    label: 'Cynomolgus Monkey',
    bodyWeight_kg: 4.0,
    liverWeight_g: 80.0,
    liverWeight_fraction: 0.020,
    MPPGL: 50,
    HPGL: 130,
    hepaticBloodFlow_mL_min: 112.0,
    hepaticBloodFlow_mL_min_kg: 28.0,
    brainWeight_g: 80.0,
    MLP_years: 40.0,
    plasmaProtein_g_L: 70,
    RBC_L_L: 0.42,
    fumic_default: 1.0,
    fuhep_default: 1.0,
    ...DEFAULT_NONHUMAN_KDEG,
  },

  // rhesus_monkey is an alias for monkey in many workflows
  rhesus_monkey: {
    species: 'rhesus_monkey',
    label: 'Rhesus Monkey',
    bodyWeight_kg: 5.0,
    liverWeight_g: 100.0,
    liverWeight_fraction: 0.020,
    MPPGL: 52,
    HPGL: 135,
    hepaticBloodFlow_mL_min: 140.0,
    hepaticBloodFlow_mL_min_kg: 28.0,
    brainWeight_g: 87.0,
    MLP_years: 40.0,
    plasmaProtein_g_L: 72,
    RBC_L_L: 0.42,
    fumic_default: 1.0,
    fuhep_default: 1.0,
    ...DEFAULT_NONHUMAN_KDEG,
  },

  minipig: {
    species: 'minipig',
    label: 'Minipig (Göttingen)',
    bodyWeight_kg: 30.0,
    liverWeight_g: 580.0,
    liverWeight_fraction: 0.019,
    MPPGL: 38,
    HPGL: 109,
    hepaticBloodFlow_mL_min: 510.0,
    hepaticBloodFlow_mL_min_kg: 17.0,
    brainWeight_g: 80.0,
    MLP_years: 27.0,
    plasmaProtein_g_L: 65,
    RBC_L_L: 0.38,
    fumic_default: 1.0,
    fuhep_default: 1.0,
    ...DEFAULT_NONHUMAN_KDEG,
  },

  human: {
    species: 'human',
    label: 'Human',
    bodyWeight_kg: 70.0,
    liverWeight_g: 1800.0,
    liverWeight_fraction: 0.026,
    MPPGL: 45,
    HPGL: 120,
    hepaticBloodFlow_mL_min: 1500.0,
    hepaticBloodFlow_mL_min_kg: 21.4,
    brainWeight_g: 1400.0,
    MLP_years: 87.5,
    plasmaProtein_g_L: 72,
    RBC_L_L: 0.45,
    fumic_default: 1.0,
    fuhep_default: 1.0,
    // CYP content (pmol/mg microsomal protein) — Rodrigues 1999, Lim et al. 1999
    CYP3A4_pmol_mg: 108,
    CYP2D6_pmol_mg: 10,
    CYP2C9_pmol_mg: 73,
    ...HUMAN_CYP_KDEG,
  },

  custom: {
    species: 'custom',
    label: 'Custom',
    bodyWeight_kg: 70.0,
    liverWeight_g: 1800.0,
    liverWeight_fraction: 0.026,
    MPPGL: 45,
    HPGL: 120,
    hepaticBloodFlow_mL_min: 1500.0,
    hepaticBloodFlow_mL_min_kg: 21.4,
    brainWeight_g: 1400.0,
    MLP_years: 87.5,
    plasmaProtein_g_L: 72,
    RBC_L_L: 0.45,
    fumic_default: 1.0,
    fuhep_default: 1.0,
    ...HUMAN_CYP_KDEG,
  },
};

// ---------------------------------------------------------------------------
// Helper — return physiology with optional field overrides
// ---------------------------------------------------------------------------
export function getSpeciesPhysiology(
  species: Species,
  overrides?: Partial<SpeciesPhysiology>,
): SpeciesPhysiology {
  const base = PHYSIOLOGY_DB[species];
  if (!base) {
    throw new Error(`Unknown species: ${species}`);
  }
  if (!overrides) return base;
  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// Human-readable species labels
// ---------------------------------------------------------------------------
export const SPECIES_LABELS: Record<Species, string> = {
  mouse:              'Mouse',
  rat:                'Rat',
  rabbit:             'Rabbit',
  guinea_pig:         'Guinea Pig',
  hamster:            'Hamster',
  dog:                'Dog (Beagle)',
  monkey:             'Rhesus Monkey',
  cynomolgus_monkey:  'Cynomolgus Monkey',
  rhesus_monkey:      'Rhesus Monkey',
  minipig:            'Minipig (Göttingen)',
  human:              'Human',
  custom:             'Custom',
};

// ---------------------------------------------------------------------------
// Default human parameters used in allometric predictions
// ---------------------------------------------------------------------------
export const HUMAN_DEFAULTS = {
  bodyWeight_kg:   70,
  fup:             undefined as number | undefined,
  brainWeight_g:   1400,
  MLP_years:       87.5,
};
