// =============================================================================
// FORMULA REGISTRY — every equation used in the ClinPharm platform
// Documented with name, LaTeX, plain text, variables, units, assumptions, source
// =============================================================================

import type { ModuleType } from '@/types';

export interface VariableDef {
  symbol: string;
  description: string;
  unit: string;
  typical_range?: string;
}

export interface FormulaEntry {
  id: string;
  name: string;
  module: ModuleType;
  method?: string;
  latexEquation: string;
  plainEquation: string;
  variables: VariableDef[];
  assumptions: string[];
  source: string;
  notes?: string;
}

// =============================================================================
// FORMULA REGISTRY
// =============================================================================
export const FORMULA_REGISTRY: FormulaEntry[] = [

  // ---------------------------------------------------------------------------
  // ALLOMETRY
  // ---------------------------------------------------------------------------
  {
    id: 'allo_simple_power',
    name: 'Simple Allometric Power Law',
    module: 'allometry',
    method: 'simple',
    latexEquation: 'P = a \\cdot BW^{b}',
    plainEquation: 'P = a × BW^b',
    variables: [
      { symbol: 'P',   description: 'Pharmacokinetic parameter (CL or Vss)',     unit: 'mL/min or L',   typical_range: 'species-dependent' },
      { symbol: 'a',   description: 'Allometric coefficient',                     unit: 'same as P when BW=1 kg', typical_range: '0.1–500' },
      { symbol: 'BW',  description: 'Body weight',                                unit: 'kg',            typical_range: '0.02–70' },
      { symbol: 'b',   description: 'Allometric exponent',                        unit: 'dimensionless', typical_range: '0.6–1.0 (CL); 0.8–1.1 (Vss)' },
    ],
    assumptions: [
      'Log-linear relationship between PK parameter and body weight across species.',
      'Metabolic and structural similarities are captured by the power relationship.',
      'Minimum 3 animal species required for regression.',
    ],
    source: 'Boxenbaum H. J Pharmacokinet Biopharm. 1982;10(2):201-27. Dedrick RL. J Pharmacokinet Biopharm. 1973;1(5):435-61.',
    notes: 'The most widely used allometric approach; provides initial CL and Vss estimates.',
  },

  {
    id: 'allo_log_linear',
    name: 'Allometric Regression — Linearised Log Form',
    module: 'allometry',
    method: 'simple',
    latexEquation: '\\ln(P) = \\ln(a) + b \\cdot \\ln(BW)',
    plainEquation: 'ln(P) = ln(a) + b × ln(BW)',
    variables: [
      { symbol: 'P',   description: 'PK parameter',    unit: 'mL/min or L' },
      { symbol: 'a',   description: 'Coefficient',     unit: 'varies' },
      { symbol: 'b',   description: 'Exponent',        unit: 'dimensionless' },
      { symbol: 'BW',  description: 'Body weight',     unit: 'kg' },
    ],
    assumptions: [
      'Ordinary least-squares regression in log-log space.',
      'Residuals are normally distributed on the log scale.',
    ],
    source: 'Mahmood I, Balian JD. J Pharm Sci. 1996;85(10):1101-6.',
    notes: 'Used to estimate a and b by OLS regression of ln(P) on ln(BW).',
  },

  {
    id: 'allo_prediction',
    name: 'Human PK Prediction from Allometry',
    module: 'allometry',
    method: 'simple',
    latexEquation: 'P_{human} = a \\cdot BW_{human}^{b}',
    plainEquation: 'P_human = a × BW_human^b',
    variables: [
      { symbol: 'P_{human}',   description: 'Predicted human parameter',   unit: 'mL/min or L' },
      { symbol: 'a',           description: 'Estimated allometric coefficient', unit: 'varies' },
      { symbol: 'BW_{human}',  description: 'Human body weight (default 70 kg)', unit: 'kg' },
      { symbol: 'b',           description: 'Estimated allometric exponent',    unit: 'dimensionless' },
    ],
    assumptions: [
      'Allometric relationship derived from animal data is applicable to humans.',
      'Standard 70 kg reference human is used unless overridden.',
    ],
    source: 'Boxenbaum H, Ronfeld R. J Pharmacokinet Biopharm. 1983;11(5):509-32.',
  },

  {
    id: 'allo_unbound_fraction',
    name: 'Allometry with Unbound Fraction Correction',
    module: 'allometry',
    method: 'unbound_fraction',
    latexEquation: 'CL_{u} = CL / f_{up} \\quad\\Rightarrow\\quad CL_{human} = (a \\cdot BW^{b}) \\cdot f_{up,human}',
    plainEquation: 'CL_u = CL / fup → regress CL_u vs BW → CL_human = a·BW_human^b × fup_human',
    variables: [
      { symbol: 'CL_{u}',       description: 'Unbound clearance',           unit: 'mL/min' },
      { symbol: 'CL',           description: 'Total plasma clearance',       unit: 'mL/min' },
      { symbol: 'f_{up}',       description: 'Fraction unbound in plasma',   unit: 'dimensionless', typical_range: '0.01–1' },
      { symbol: 'f_{up,human}', description: 'Human fraction unbound',       unit: 'dimensionless' },
    ],
    assumptions: [
      'Unbound CL is conserved across species.',
      'Plasma protein binding differences account for inter-species CL variability.',
    ],
    source: 'Obach RS, Baxter JG, Liston TE, et al. J Pharmacol Exp Ther. 1997;283(1):46-58.',
    notes: 'Particularly useful for high-extraction or highly protein-bound compounds.',
  },

  {
    id: 'allo_brain_weight',
    name: 'Allometry with Brain Weight Correction (Compound Exponent)',
    module: 'allometry',
    method: 'brain_weight',
    latexEquation: 'CL \\cdot MLP = a \\cdot BW^{b}',
    plainEquation: 'CL × BrainW = a × BW^b  [brain weight method variant]',
    variables: [
      { symbol: 'BrainW', description: 'Brain weight',      unit: 'g',  typical_range: '0.4–1400' },
      { symbol: 'CL',     description: 'Clearance',          unit: 'mL/min' },
      { symbol: 'a',      description: 'Coefficient',         unit: 'varies' },
      { symbol: 'BW',     description: 'Body weight',         unit: 'kg' },
      { symbol: 'b',      description: 'Exponent',            unit: 'dimensionless' },
    ],
    assumptions: [
      'Brain weight normalises differences in metabolic rate across species.',
      'Applicable when simple allometry over- or under-predicts human CL.',
    ],
    source: 'Boxenbaum H. J Pharmacokinet Biopharm. 1982;10(2):201-27.',
    notes: 'Brain weight correction tends to lower predictions relative to simple allometry.',
  },

  {
    id: 'allo_MLP',
    name: 'Allometry with Maximum Life Potential (MLP) Correction',
    module: 'allometry',
    method: 'MLP',
    latexEquation: 'CL \\cdot MLP = a \\cdot BW^{b}',
    plainEquation: 'CL × MLP = a × BW^b  →  CL_human = (a × BW_human^b) / MLP_human',
    variables: [
      { symbol: 'MLP',  description: 'Maximum life potential (years)', unit: 'years', typical_range: '3.5–87.5' },
      { symbol: 'CL',   description: 'Clearance',                       unit: 'mL/min' },
      { symbol: 'a',    description: 'Coefficient',                      unit: 'mL/min·yr' },
      { symbol: 'BW',   description: 'Body weight',                      unit: 'kg' },
      { symbol: 'b',    description: 'Exponent',                         unit: 'dimensionless' },
    ],
    assumptions: [
      'Longer-lived species have proportionally lower metabolic rates per unit BW.',
      'MLP is estimated as 185.4 × BrainW_kg^0.636 × BW_kg^(-0.225) (Sacher 1975).',
    ],
    source: 'Boxenbaum H, Clancy M. J Pharmacokinet Biopharm. 1984;12(3):309-33. Sacher GA. 1975 in Neurobiology of Aging.',
  },

  {
    id: 'allo_PE_percent',
    name: 'Percent Prediction Error',
    module: 'allometry',
    latexEquation: 'PE\\% = \\frac{P_{pred} - P_{obs}}{P_{obs}} \\times 100',
    plainEquation: 'PE% = (P_pred - P_obs) / P_obs × 100',
    variables: [
      { symbol: 'P_{pred}', description: 'Predicted value',  unit: 'same as P' },
      { symbol: 'P_{obs}',  description: 'Observed value',   unit: 'same as P' },
    ],
    assumptions: ['Used for back-prediction to assess allometric fit quality.'],
    source: 'Mahmood I. Drug Metab Drug Interact. 2005;21(1):1-16.',
  },

  {
    id: 'allo_AAFE',
    name: 'Average Absolute Fold Error (AAFE)',
    module: 'allometry',
    latexEquation: 'AAFE = 10^{\\frac{1}{n}\\sum_{i=1}^{n}|\\log_{10}(P_{pred,i}/P_{obs,i})|}',
    plainEquation: 'AAFE = 10^(mean of |log10(P_pred/P_obs)|)',
    variables: [
      { symbol: 'P_{pred,i}', description: 'Predicted value for species i',  unit: 'same as P' },
      { symbol: 'P_{obs,i}',  description: 'Observed value for species i',   unit: 'same as P' },
      { symbol: 'n',          description: 'Number of species',               unit: 'dimensionless' },
    ],
    assumptions: ['Geometric mean of fold errors; symmetric on log scale.'],
    source: 'Obach RS, Baxter JG, Liston TE, et al. J Pharmacol Exp Ther. 1997;283(1):46-58.',
    notes: 'AAFE ≤ 2 is generally considered acceptable for allometric predictions.',
  },

  {
    id: 'allo_fixed_exponent',
    name: 'Fixed Exponent Allometry',
    module: 'allometry',
    method: 'fixed_exponent_0_75',
    latexEquation: 'CL_{human} = CL_{animal} \\cdot \\left(\\frac{BW_{human}}{BW_{animal}}\\right)^{0.75}',
    plainEquation: 'CL_human = CL_animal × (BW_human / BW_animal)^exponent',
    variables: [
      { symbol: 'CL_{animal}',  description: 'Observed animal clearance',    unit: 'mL/min' },
      { symbol: 'BW_{human}',   description: 'Human body weight',            unit: 'kg' },
      { symbol: 'BW_{animal}',  description: 'Animal body weight',           unit: 'kg' },
    ],
    assumptions: [
      'Fixed exponent of 0.75 based on metabolic theory (West et al.).',
      'Single-species prediction; does not require regression.',
    ],
    source: 'West GB, Brown JH, Enquist BJ. Science. 1997;276(5309):122-6. Mordenti J. J Pharm Sci. 1986;75(11):1028-40.',
    notes: 'Also used with exponents 0.85 and 1.0 for different compound types.',
  },

  {
    id: 'allo_liver_blood_flow',
    name: 'Liver Blood Flow Normalisation',
    module: 'allometry',
    method: 'liver_blood_flow',
    latexEquation: 'CL_{human} = CL_{animal} \\cdot \\frac{Q_{h,human}}{Q_{h,animal}}',
    plainEquation: 'CL_human = CL_animal × (Qh_human / Qh_animal)',
    variables: [
      { symbol: 'CL_{animal}',  description: 'Animal clearance',       unit: 'mL/min' },
      { symbol: 'Q_{h,human}',  description: 'Human hepatic blood flow', unit: 'mL/min', typical_range: '~1500' },
      { symbol: 'Q_{h,animal}', description: 'Animal hepatic blood flow', unit: 'mL/min' },
    ],
    assumptions: [
      'Compound is a high-extraction drug (Eh ≥ 0.7).',
      'Hepatic clearance is limited by liver blood flow.',
    ],
    source: 'Lave T, et al. Pharm Res. 1997;14(2):189-98. Davies B, Morris T. Pharm Res. 1993;10(7):1093-5.',
  },

  {
    id: 'allo_rule_of_exponent',
    name: 'Rule of Exponent (Mahmood & Balian)',
    module: 'allometry',
    method: 'rule_of_exponent',
    latexEquation: 'b < 0.71 \\Rightarrow simple; \\; 0.71 \\leq b \\leq 1.0 \\Rightarrow \\times MLP; \\; b > 1.0 \\Rightarrow \\times BrainW',
    plainEquation: 'If b<0.71: use simple allometry; 0.71≤b≤1.0: multiply by MLP; b>1.0: multiply by BrainW',
    variables: [
      { symbol: 'b',     description: 'Allometric exponent from simple regression', unit: 'dimensionless' },
      { symbol: 'MLP',   description: 'Maximum life potential',                      unit: 'years' },
      { symbol: 'BrainW', description: 'Brain weight',                              unit: 'g' },
    ],
    assumptions: [
      'Exponent b guides the best correction factor.',
      'Provides a decision rule rather than a fixed method.',
    ],
    source: 'Mahmood I, Balian JD. J Pharm Sci. 1996;85(10):1101-6.',
    notes: 'One of the most cited allometric correction approaches.',
  },

  {
    id: 'allo_caldwell_tang_1',
    name: 'Caldwell–Tang Method 1 (Unbound CL + MLP)',
    module: 'allometry',
    method: 'caldwell_tang_1',
    latexEquation: 'CL_{u} \\cdot MLP = a \\cdot BW^{b}',
    plainEquation: 'CL_u × MLP = a × BW^b → CL_human = a·70^b / MLP_human × fup_human',
    variables: [
      { symbol: 'CL_{u}', description: 'Unbound clearance',         unit: 'mL/min' },
      { symbol: 'MLP',    description: 'Maximum life potential',     unit: 'years' },
      { symbol: 'f_{up}', description: 'Unbound plasma fraction',    unit: 'dimensionless' },
    ],
    assumptions: [
      'Combines MLP and unbound fraction corrections.',
      'Recommended for compounds with species-variable protein binding and intermediate exponents.',
    ],
    source: 'Caldwell GW, Masucci JA, Yan Z, Hageman W. Eur J Drug Metab Pharmacokinet. 2004;29(2):133-43. Tang H, Mayersohn M. Drug Metab Dispos. 2005;33(9):1288-95.',
  },

  // ---------------------------------------------------------------------------
  // IVIVE
  // ---------------------------------------------------------------------------
  {
    id: 'ivive_microsomal_scaling',
    name: 'Microsomal Scaling: In-vitro to In-vivo CLint',
    module: 'ivive',
    latexEquation: 'CL_{int,invivo} = CL_{int,app} \\times MPPGL \\times LW',
    plainEquation: 'CLint_invivo (mL/min) = CLint_app (µL/min/mg) × MPPGL (mg/g liver) × LW (g liver)',
    variables: [
      { symbol: 'CL_{int,app}', description: 'Apparent intrinsic CL from microsomes', unit: 'µL/min/mg protein' },
      { symbol: 'MPPGL',        description: 'Microsomal protein per gram liver',       unit: 'mg/g',      typical_range: '38–52' },
      { symbol: 'LW',           description: 'Liver weight',                            unit: 'g',         typical_range: '1–1800' },
    ],
    assumptions: [
      'Linear kinetics (substrate concentration << Km).',
      'Microsomes represent the metabolic capacity of the whole liver.',
      'No consideration of non-specific binding in microsomes unless fumic correction applied.',
    ],
    source: 'Houston JB. Biochem Pharmacol. 1994;47(9):1469-79. Obach RS. Drug Metab Dispos. 1999;27(11):1350-9.',
  },

  {
    id: 'ivive_hepatocyte_scaling',
    name: 'Hepatocyte Scaling: In-vitro to In-vivo CLint',
    module: 'ivive',
    latexEquation: 'CL_{int,invivo} = CL_{int,app} \\times HPGL \\times LW',
    plainEquation: 'CLint_invivo (mL/min) = CLint_app (µL/min/10^6 cells) × HPGL (10^6 cells/g) × LW (g)',
    variables: [
      { symbol: 'CL_{int,app}', description: 'Apparent intrinsic CL from hepatocytes', unit: 'µL/min/10^6 cells' },
      { symbol: 'HPGL',         description: 'Hepatocytes per gram liver',               unit: '10^6 cells/g',  typical_range: '109–215' },
      { symbol: 'LW',           description: 'Liver weight',                             unit: 'g' },
    ],
    assumptions: [
      'Hepatocytes preserve all phase I and II metabolic pathways.',
      'Cell viability assumed adequate (>85% trypan blue exclusion).',
    ],
    source: 'Soars MG, et al. Xenobiotica. 2007;37(10-11):1195-209. Barter ZE, et al. Curr Drug Metab. 2007;8(1):33-45.',
  },

  {
    id: 'ivive_well_stirred_no_binding',
    name: 'Well-Stirred Model (No Binding Correction)',
    module: 'ivive',
    method: 'well_stirred_no_binding',
    latexEquation: 'CL_h = \\frac{Q_h \\cdot CL_{int,u}}{Q_h + CL_{int,u}}',
    plainEquation: 'CLh = Qh × CLint_u / (Qh + CLint_u)',
    variables: [
      { symbol: 'CL_h',       description: 'Hepatic clearance',                    unit: 'mL/min' },
      { symbol: 'Q_h',        description: 'Hepatic blood flow',                   unit: 'mL/min' },
      { symbol: 'CL_{int,u}', description: 'In-vivo intrinsic clearance (unbound)', unit: 'mL/min' },
    ],
    assumptions: [
      'Liver is a single well-mixed compartment.',
      'No plasma or microsomal protein binding correction applied.',
      'Drug concentration in hepatocytes equals unbound plasma concentration.',
    ],
    source: 'Rowland M, Benet LZ, Graham GG. J Pharmacokinet Biopharm. 1973;1(2):123-36.',
  },

  {
    id: 'ivive_well_stirred_with_binding',
    name: 'Well-Stirred Model (With Binding Correction)',
    module: 'ivive',
    method: 'well_stirred_with_binding',
    latexEquation: 'CL_h = \\frac{Q_h \\cdot f_{up} \\cdot CL_{int,u}}{Q_h + f_{up} \\cdot CL_{int,u}}',
    plainEquation: 'CLh = Qh × fup × CLint_u / (Qh + fup × CLint_u)',
    variables: [
      { symbol: 'CL_h',       description: 'Hepatic clearance',          unit: 'mL/min' },
      { symbol: 'Q_h',        description: 'Hepatic blood flow',         unit: 'mL/min' },
      { symbol: 'f_{up}',     description: 'Unbound fraction in plasma', unit: 'dimensionless', typical_range: '0.01–1' },
      { symbol: 'CL_{int,u}', description: 'Unbound intrinsic CL',       unit: 'mL/min' },
    ],
    assumptions: [
      'Liver behaves as a single well-mixed compartment.',
      'Binding in plasma is in rapid equilibrium.',
    ],
    source: 'Rowland M, Benet LZ, Graham GG. J Pharmacokinet Biopharm. 1973;1(2):123-36. Wilkinson GR, Shand DG. Clin Pharmacol Ther. 1975;18(4):377-90.',
  },

  {
    id: 'ivive_parallel_tube',
    name: 'Parallel Tube (Undistributed Sinusoidal) Model',
    module: 'ivive',
    method: 'parallel_tube',
    latexEquation: 'CL_h = Q_h \\cdot \\left(1 - e^{-f_{up} \\cdot CL_{int,u}/Q_h}\\right)',
    plainEquation: 'CLh = Qh × (1 − exp(−fup × CLint_u / Qh))',
    variables: [
      { symbol: 'CL_h',       description: 'Hepatic clearance',          unit: 'mL/min' },
      { symbol: 'Q_h',        description: 'Hepatic blood flow',         unit: 'mL/min' },
      { symbol: 'f_{up}',     description: 'Unbound fraction in plasma', unit: 'dimensionless' },
      { symbol: 'CL_{int,u}', description: 'Unbound intrinsic CL',       unit: 'mL/min' },
    ],
    assumptions: [
      'Drug concentration declines exponentially along the sinusoid.',
      'Better suited for high-extraction compounds than the well-stirred model.',
    ],
    source: 'Pang KS, Rowland M. J Pharmacokinet Biopharm. 1977;5(6):625-53.',
  },

  {
    id: 'ivive_extraction_ratio',
    name: 'Hepatic Extraction Ratio',
    module: 'ivive',
    latexEquation: 'E_h = \\frac{CL_h}{Q_h}',
    plainEquation: 'Eh = CLh / Qh',
    variables: [
      { symbol: 'E_h', description: 'Hepatic extraction ratio', unit: 'dimensionless', typical_range: '0–1' },
      { symbol: 'CL_h', description: 'Hepatic clearance',       unit: 'mL/min' },
      { symbol: 'Q_h',  description: 'Hepatic blood flow',      unit: 'mL/min' },
    ],
    assumptions: [
      'Low extraction: Eh < 0.30; Medium: 0.30–0.70; High: Eh > 0.70.',
    ],
    source: 'Wilkinson GR, Shand DG. Clin Pharmacol Ther. 1975;18(4):377-90.',
  },

  {
    id: 'ivive_back_calc_CLint',
    name: 'Back-Calculation of In-vitro CLint from Observed CLh',
    module: 'ivive',
    latexEquation: 'CL_{int,u} = \\frac{Q_h \\cdot CL_h}{(Q_h - CL_h) \\cdot f_{up}}',
    plainEquation: 'CLint_u = Qh × CLh / ((Qh − CLh) × fup)',
    variables: [
      { symbol: 'CL_{int,u}', description: 'Required unbound intrinsic CL', unit: 'mL/min' },
      { symbol: 'CL_h',       description: 'Observed hepatic clearance',     unit: 'mL/min' },
      { symbol: 'Q_h',        description: 'Hepatic blood flow',             unit: 'mL/min' },
      { symbol: 'f_{up}',     description: 'Unbound fraction in plasma',     unit: 'dimensionless' },
    ],
    assumptions: [
      'Well-stirred model assumed for back-calculation.',
      'Not applicable when CLh > Qh.',
    ],
    source: 'Houston JB, Carlile DJ. Drug Metab Rev. 1997;29(4):891-922.',
  },

  {
    id: 'ivive_fuB_definition',
    name: 'Unbound Fraction in Blood (fuB)',
    module: 'ivive',
    latexEquation: 'f_{uB} = \\frac{f_{up}}{B/P}',
    plainEquation: 'fuB = fup / BP_ratio',
    variables: [
      { symbol: 'f_{uB}',  description: 'Unbound fraction in blood',          unit: 'dimensionless', typical_range: '0.001–1' },
      { symbol: 'f_{up}',  description: 'Unbound fraction in plasma',         unit: 'dimensionless' },
      { symbol: 'B/P',     description: 'Blood-to-plasma concentration ratio', unit: 'dimensionless', typical_range: '0.5–2.0' },
    ],
    assumptions: [
      'Blood-to-plasma ratio is constant (linear kinetics).',
      'Used to convert plasma-based CLint to blood-based CL.',
    ],
    source: 'Poulin P, Theil FP. J Pharm Sci. 2002;91(1):129-56.',
  },

  {
    id: 'ivive_fumic_correction',
    name: 'Microsomal Binding Correction (fumic)',
    module: 'ivive',
    latexEquation: 'CL_{int,u} = \\frac{CL_{int,app}}{f_{umic}}',
    plainEquation: 'CLint_u = CLint_app / fumic',
    variables: [
      { symbol: 'CL_{int,u}',   description: 'Unbound intrinsic CL',                          unit: 'µL/min/mg' },
      { symbol: 'CL_{int,app}', description: 'Apparent intrinsic CL (includes bound drug)',   unit: 'µL/min/mg' },
      { symbol: 'f_{umic}',     description: 'Unbound fraction in microsomal incubation',     unit: 'dimensionless', typical_range: '0.1–1' },
    ],
    assumptions: [
      'Non-specific binding to microsomal lipids reduces free substrate concentration.',
      'Austin equation (fumic = 1 / (1 + 125·Vd·protein_conc)) or direct measurement preferred.',
    ],
    source: 'Obach RS. Drug Metab Dispos. 1999;27(11):1350-9. Austin RP, et al. Drug Metab Dispos. 2002;30(12):1497-503.',
  },

  // ---------------------------------------------------------------------------
  // DDI
  // ---------------------------------------------------------------------------
  {
    id: 'ddi_AUCR_max_reversible',
    name: 'AUCR (Maximum) — Reversible Inhibition',
    module: 'ddi',
    latexEquation: 'AUCR_{max} = 1 + \\frac{I_{u,max}}{K_i}',
    plainEquation: 'AUCR_max = 1 + (Iu_max / Ki)',
    variables: [
      { symbol: 'AUCR_{max}',  description: 'Maximum AUC ratio (victim/victim+inhibitor)', unit: 'dimensionless' },
      { symbol: 'I_{u,max}',   description: 'Maximum unbound inhibitor concentration',     unit: 'µM' },
      { symbol: 'K_i',         description: 'Inhibition constant',                          unit: 'µM' },
    ],
    assumptions: [
      'Reversible, competitive inhibition assumed.',
      'Iu_max used as worst-case (systemic) concentration.',
      'Threshold for further investigation: AUCR ≥ 1.02 (EMA) or R1 ≥ 1.02.',
    ],
    source: 'EMA Guideline on the investigation of drug interactions. 2012. FDA Drug Interaction Studies guidance. 2020.',
  },

  {
    id: 'ddi_AUCR_partial',
    name: 'AUCR — Partial Inhibition (fm Weighted)',
    module: 'ddi',
    latexEquation: 'AUCR = \\frac{1}{f_m / AUCR_{enzyme} + (1 - f_m)}',
    plainEquation: 'AUCR = 1 / (fm / AUCR_enzyme + (1 − fm))',
    variables: [
      { symbol: 'f_m',          description: 'Fraction of substrate cleared by the inhibited enzyme', unit: 'dimensionless', typical_range: '0–1' },
      { symbol: 'AUCR_{enzyme}', description: 'AUCR for complete inhibition of that enzyme',          unit: 'dimensionless' },
    ],
    assumptions: [
      'Other elimination pathways are unaffected.',
      'fm values summing to 1 for all pathways.',
    ],
    source: 'Ito K, et al. Br J Clin Pharmacol. 2004;58(4):347-56. EMA DDI Guideline 2012.',
  },

  {
    id: 'ddi_R1_ratio',
    name: 'R1 Ratio — Reversible Inhibition Basic Model',
    module: 'ddi',
    latexEquation: 'R_1 = 1 + \\frac{I_{u,max}}{K_i}',
    plainEquation: 'R1 = 1 + Iu_max / Ki',
    variables: [
      { symbol: 'R_1',        description: 'Inhibitory quotient (systemic)',       unit: 'dimensionless' },
      { symbol: 'I_{u,max}',  description: 'Maximum unbound systemic concentration', unit: 'µM' },
      { symbol: 'K_i',        description: 'Inhibition constant',                    unit: 'µM' },
    ],
    assumptions: [
      'R1 ≥ 1.02: proceed to mechanistic static or dynamic modelling (EMA).',
      'R1 uses systemic Iu_max; R1,gut uses gut lumen concentration.',
    ],
    source: 'EMA Guideline on the investigation of drug interactions. 2012.',
  },

  {
    id: 'ddi_TDI_lambda',
    name: 'TDI Apparent Inactivation Rate Constant (λ)',
    module: 'ddi',
    latexEquation: '\\lambda = \\frac{k_{inact} \\cdot I_{u,max}}{K_I + I_{u,max}}',
    plainEquation: 'λ = kinact × Iu_max / (KI + Iu_max)',
    variables: [
      { symbol: '\\lambda',    description: 'Apparent inactivation rate constant',              unit: 'h⁻¹' },
      { symbol: 'k_{inact}',   description: 'Maximum inactivation rate constant',               unit: 'h⁻¹', typical_range: '0.1–10' },
      { symbol: 'K_I',         description: 'Inhibitor concentration at half-maximal kinact',   unit: 'µM',  typical_range: '0.01–100' },
      { symbol: 'I_{u,max}',   description: 'Maximum unbound inhibitor concentration',          unit: 'µM' },
    ],
    assumptions: [
      'Mechanism-based (time-dependent) inhibition.',
      'Inactivation follows Michaelis-Menten kinetics with respect to inhibitor concentration.',
    ],
    source: 'Silverman RB. Methods Enzymol. 1995;249:240-83. Grime K, Riley RJ. Curr Drug Metab. 2006;7(3):251-64.',
  },

  {
    id: 'ddi_TDI_remaining_activity',
    name: 'TDI Remaining Enzyme Activity',
    module: 'ddi',
    latexEquation: 'A_{remaining} = \\frac{k_{deg}}{k_{deg} + \\lambda}',
    plainEquation: 'A_remaining = kdeg / (kdeg + λ)',
    variables: [
      { symbol: 'A_{remaining}', description: 'Remaining CYP activity fraction', unit: 'dimensionless', typical_range: '0–1' },
      { symbol: 'k_{deg}',       description: 'CYP degradation rate constant',    unit: 'h⁻¹' },
      { symbol: '\\lambda',      description: 'Apparent inactivation rate',        unit: 'h⁻¹' },
    ],
    assumptions: [
      'Steady-state between enzyme inactivation and de-novo synthesis assumed.',
    ],
    source: 'Obach RS, Walsky RL, Venkatakrishnan K. Drug Metab Dispos. 2007;35(2):246-55.',
  },

  {
    id: 'ddi_R2_TDI',
    name: 'R2 Ratio — TDI Basic Model',
    module: 'ddi',
    latexEquation: 'R_2 = \\frac{k_{deg}}{k_{deg} + \\lambda}',
    plainEquation: 'R2 = kdeg / (kdeg + λ)',
    variables: [
      { symbol: 'R_2',      description: 'TDI inhibitory quotient',              unit: 'dimensionless', typical_range: '0–1' },
      { symbol: 'k_{deg}',  description: 'CYP enzyme degradation rate constant', unit: 'h⁻¹' },
      { symbol: '\\lambda', description: 'Apparent first-order inactivation rate', unit: 'h⁻¹' },
    ],
    assumptions: [
      'R2 < 0.9 (i.e., >10% inactivation) triggers further evaluation per EMA/FDA.',
    ],
    source: 'EMA Guideline on the investigation of drug interactions. 2012. FDA Drug Interaction Studies guidance. 2020.',
  },

  {
    id: 'ddi_fold_induction',
    name: 'Fold Induction (Emax Model)',
    module: 'ddi',
    latexEquation: 'Fold\\;induction = 1 + \\frac{E_{max} \\cdot I_{u,max}}{EC_{50} + I_{u,max}}',
    plainEquation: 'Fold induction = 1 + Emax × Iu_max / (EC50 + Iu_max)',
    variables: [
      { symbol: 'E_{max}',   description: 'Maximum fold induction',              unit: 'fold',          typical_range: '2–50' },
      { symbol: 'EC_{50}',   description: 'Concentration at half-maximal Emax',  unit: 'µM',            typical_range: '0.1–50' },
      { symbol: 'I_{u,max}', description: 'Maximum unbound inducer concentration', unit: 'µM' },
    ],
    assumptions: [
      'Signal transduction effects captured by simple Emax model.',
      'mRNA or protein induction data from fresh human hepatocytes.',
    ],
    source: 'Fahmi OA, et al. Drug Metab Dispos. 2008;36(8):1698-708. EMA DDI Guideline 2012.',
  },

  {
    id: 'ddi_transporter_R_gut',
    name: 'Transporter Inhibition — Intestinal (Rgut)',
    module: 'ddi',
    latexEquation: 'R_{gut} = 1 + \\frac{I_{gut}}{IC_{50}}',
    plainEquation: 'Rgut = 1 + Igut / IC50',
    variables: [
      { symbol: 'R_{gut}', description: 'Gut transporter inhibition ratio',          unit: 'dimensionless' },
      { symbol: 'I_{gut}', description: 'Gut lumen inhibitor concentration (Dose/250 mL)', unit: 'µM' },
      { symbol: 'IC_{50}', description: 'Half-maximal inhibitory concentration',     unit: 'µM' },
    ],
    assumptions: [
      'Gut lumen concentration estimated as dose / 250 mL.',
      'Applicable to P-gp, BCRP, and OATP intestinal transporters.',
      'Threshold: Rgut ≥ 10 for intestinal P-gp/BCRP (EMA).',
    ],
    source: 'EMA Guideline on the investigation of drug interactions. 2012. FDA Drug Interaction Studies guidance. 2020.',
  },

  {
    id: 'ddi_transporter_R_systemic',
    name: 'Transporter Inhibition — Systemic (R value)',
    module: 'ddi',
    latexEquation: 'R = 1 + \\frac{I_{u,max}}{IC_{50}}',
    plainEquation: 'R = 1 + Iu_max / IC50',
    variables: [
      { symbol: 'R',          description: 'Systemic transporter inhibition ratio', unit: 'dimensionless' },
      { symbol: 'I_{u,max}',  description: 'Maximum unbound systemic concentration', unit: 'µM' },
      { symbol: 'IC_{50}',    description: 'Half-maximal inhibitory concentration',  unit: 'µM' },
    ],
    assumptions: [
      'Threshold: R ≥ 1.02 (OATP1B1/1B3, OAT1/3, OCT2, MATE1/2K).',
      'Ki = IC50 / 2 for competitive inhibitors if Ki not measured directly.',
    ],
    source: 'EMA Guideline on the investigation of drug interactions. 2012. FDA Drug Interaction Studies guidance. 2020.',
  },

  // ---------------------------------------------------------------------------
  // GENERAL PK
  // ---------------------------------------------------------------------------
  {
    id: 'pk_half_life',
    name: 'Elimination Half-Life',
    module: 'allometry',
    latexEquation: 't_{1/2} = \\frac{0.693 \\cdot V_{ss}}{CL}',
    plainEquation: 't½ = 0.693 × Vss / CL',
    variables: [
      { symbol: 't_{1/2}', description: 'Terminal elimination half-life', unit: 'h' },
      { symbol: 'V_{ss}',  description: 'Volume of distribution at steady state', unit: 'L' },
      { symbol: 'CL',      description: 'Total clearance', unit: 'L/h or mL/min' },
    ],
    assumptions: [
      'One-compartment or terminal phase of multi-compartment model.',
      'Units of CL and Vss must be consistent.',
    ],
    source: 'Rowland M, Tozer TN. Clinical Pharmacokinetics and Pharmacodynamics. 4th ed. 2011.',
  },

  {
    id: 'pk_fuB_from_fup',
    name: 'Blood Unbound Fraction from Plasma fup',
    module: 'ivive',
    latexEquation: 'f_{uB} = \\frac{f_{up}}{B/P}',
    plainEquation: 'fuB = fup / BP_ratio',
    variables: [
      { symbol: 'f_{uB}', description: 'Unbound fraction in whole blood', unit: 'dimensionless' },
      { symbol: 'f_{up}', description: 'Unbound fraction in plasma',      unit: 'dimensionless' },
      { symbol: 'B/P',    description: 'Blood-to-plasma ratio',            unit: 'dimensionless' },
    ],
    assumptions: ['Whole-blood clearance model requires blood-based fuB.'],
    source: 'Obach RS. Drug Metab Dispos. 1999;27(11):1350-9.',
  },

  {
    id: 'ivive_CLint_unbound',
    name: 'Unbound Intrinsic CL (Corrected for fumic)',
    module: 'ivive',
    latexEquation: 'CL_{int,u} = \\frac{CL_{int,app}}{f_{umic}}',
    plainEquation: 'CLint_u = CLint_app / fumic',
    variables: [
      { symbol: 'CL_{int,u}',   description: 'Unbound intrinsic clearance',      unit: 'µL/min/mg' },
      { symbol: 'CL_{int,app}', description: 'Apparent (measured) intrinsic CL', unit: 'µL/min/mg' },
      { symbol: 'f_{umic}',     description: 'Unbound fraction in microsomes',   unit: 'dimensionless', typical_range: '0.1–1' },
    ],
    assumptions: [
      'fumic corrects for non-specific binding to microsomal phospholipid membranes.',
      'Particularly important for lipophilic compounds (logP > 2).',
    ],
    source: 'Austin RP, Barton P, Cockroft SL, Wenlock MC, Riley RJ. Drug Metab Dispos. 2002;30(12):1497-503.',
  },

  {
    id: 'ivive_poulin_binding_aware',
    name: 'Poulin Binding-Aware IVIVE Correction',
    module: 'ivive',
    method: 'poulin_binding_aware',
    latexEquation: 'CL_h = \\frac{Q_h \\cdot f_{uB} \\cdot CL_{int,u} / f_{umic}}{Q_h + f_{uB} \\cdot CL_{int,u} / f_{umic}}',
    plainEquation: 'CLh = Qh × (fuB × CLint_app / fumic) / (Qh + fuB × CLint_app / fumic)',
    variables: [
      { symbol: 'CL_h',         description: 'Hepatic blood clearance',            unit: 'mL/min' },
      { symbol: 'Q_h',          description: 'Hepatic blood flow',                 unit: 'mL/min' },
      { symbol: 'f_{uB}',       description: 'Unbound fraction in blood',          unit: 'dimensionless' },
      { symbol: 'CL_{int,app}', description: 'Apparent intrinsic CL',              unit: 'µL/min/mg' },
      { symbol: 'f_{umic}',     description: 'Unbound fraction in microsomes',     unit: 'dimensionless' },
    ],
    assumptions: [
      'Full binding correction in both blood and microsomal compartments.',
      'Combines well-stirred model with fuB and fumic corrections.',
    ],
    source: 'Poulin P, Haddad S. J Pharm Sci. 2011;100(10):4399-426. Poulin P, Theil FP. J Pharm Sci. 2002;91(1):129-56.',
  },
];
