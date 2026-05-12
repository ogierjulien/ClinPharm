// =============================================================================
// CLINPHARM TOOLKIT — CENTRAL TYPE DEFINITIONS
// =============================================================================

// ---------------------------------------------------------------------------
// SHARED / COMMON TYPES
// ---------------------------------------------------------------------------

export type ModuleType = 'allometry' | 'ivive' | 'ddi' | 'reporting';

export interface CompoundMetadata {
  name: string;
  id?: string;
  projectCode?: string;
  MW?: number;          // g/mol
  logP?: number;
  logD?: number;
  pKa?: number;
  drugClass?: string;
  notes?: string;
}

export interface Warning {
  code: string;
  message: string;
  severity: 'info' | 'caution' | 'warning' | 'error';
  field?: string;
}

export interface UnitDescriptor {
  value: string;       // e.g. "mL/min/kg"
  dimension?: string;  // e.g. "clearance"
  normalized?: boolean;
}

export interface RegressionResult {
  slope: number;       // allometric exponent b
  intercept: number;   // ln(a)
  a: number;           // coefficient exp(intercept)
  rSquared: number;
  rSquaredAdj?: number;
  pValue?: number;
  slopeCI95?: [number, number];
  interceptCI95?: [number, number];
  residuals: number[];
  fittedValues: number[];
  n: number;
}

export interface RunMetadata {
  runId: string;
  timestamp: string;
  appType: ModuleType;
  appVersion: string;
  formulaSetVersion: string;
  physiologyVersion: string;
  userNotes?: string;
}

export interface SessionResult<TInputs, TResults> {
  metadata: RunMetadata;
  compound: CompoundMetadata;
  inputs: TInputs;
  methodsSelected: string[];
  intermediateResults: Record<string, unknown>;
  finalResults: TResults;
  warnings: Warning[];
  assumptions: string[];
  units: Record<string, string>;
  plots?: PlotSpec[];
}

export interface PlotSpec {
  id: string;
  title: string;
  type: string;
  dataRef: string;
  svgData?: string;
  pngData?: string;
}

// ---------------------------------------------------------------------------
// PHYSIOLOGICAL DATABASE TYPES
// ---------------------------------------------------------------------------

export type Species =
  | 'mouse'
  | 'rat'
  | 'rabbit'
  | 'guinea_pig'
  | 'hamster'
  | 'dog'
  | 'monkey'
  | 'cynomolgus_monkey'
  | 'rhesus_monkey'
  | 'minipig'
  | 'human'
  | 'custom';

export interface SpeciesPhysiology {
  species: Species;
  label: string;
  bodyWeight_kg: number;             // reference BW (kg)
  liverWeight_g: number;             // reference liver weight (g)
  liverWeight_fraction: number;      // liver as fraction of BW
  MPPGL: number;                     // mg microsomal protein / g liver
  HPGL: number;                      // 10^6 hepatocytes / g liver
  hepaticBloodFlow_mL_min: number;   // Qh (mL/min) at reference BW
  hepaticBloodFlow_mL_min_kg: number; // Qh per kg
  brainWeight_g: number;
  MLP_years: number;                 // maximum life potential
  plasmaProtein_g_L?: number;
  RBC_L_L?: number;                  // haematocrit
  fumic_default?: number;
  fuhep_default?: number;
  // CYP content
  CYP3A4_pmol_mg?: number;
  CYP2D6_pmol_mg?: number;
  CYP2C9_pmol_mg?: number;
  // Enzyme degradation rates (kdeg, h⁻¹)
  kdeg_CYP1A2?: number;
  kdeg_CYP2B6?: number;
  kdeg_CYP2C8?: number;
  kdeg_CYP2C9?: number;
  kdeg_CYP2C19?: number;
  kdeg_CYP2D6?: number;
  kdeg_CYP3A4?: number;
}

// ---------------------------------------------------------------------------
// MODULE 1 — ALLOMETRY TYPES
// ---------------------------------------------------------------------------

export interface AnimalDataPoint {
  id: string;
  species: Species;
  label: string;
  bodyWeight_kg: number;
  CL_observed: number;              // absolute CL (mL/min) or per-kg — see inputMode
  Vss_observed: number;             // absolute Vss (L) or per-kg
  fup?: number;                     // unbound plasma fraction
  brainWeight_g?: number;
  MLP_years?: number;
  include: boolean;
  CL_perKg_input?: boolean;         // true = user entered per-kg values
  Vss_perKg_input?: boolean;
  // Derived absolute values (post-normalization)
  CL_abs?: number;
  Vss_abs?: number;
}

export type AllometryMethod =
  | 'simple'
  | 'unbound_fraction'
  | 'brain_weight'
  | 'MLP'
  | 'rule_of_exponent'
  | 'caldwell_tang_1'
  | 'caldwell_tang_2'
  | 'caldwell_tang_3'
  | 'liver_blood_flow'
  | 'species_invariant_time'
  | 'fixed_exponent_0_75'
  | 'fixed_exponent_0_85'
  | 'fixed_exponent_1_0'
  | 'robust_regression'
  | 'two_species'
  | 'three_species'
  | 'monkey_only'
  | 'leave_one_out';

export interface AllometryMethodConfig {
  id: AllometryMethod;
  label: string;
  description: string;
  equations: string[];           // LaTeX/plain-text
  assumptions: string[];
  provenance: string;
  requiresFup: boolean;
  requiresBrainWeight: boolean;
  requiresMLP: boolean;
  minSpecies: number;
}

export interface AllometryInputs {
  compound: CompoundMetadata;
  animalData: AnimalDataPoint[];
  humanBodyWeight_kg: number;
  humanFup?: number;
  humanBrainWeight_g?: number;
  humanMLP_years?: number;
  methodsSelected: AllometryMethod[];
  predictCL: boolean;
  predictVss: boolean;
  predictHalfLife: boolean;
  regressionWeighted: boolean;
  CL_units: string;
  Vss_units: string;
  BW_units: string;
}

export interface AllometrySingleMethodResult {
  method: AllometryMethod;
  label: string;
  regressionCL?: RegressionResult;
  regressionVss?: RegressionResult;
  predictedCL_human?: number;
  predictedVss_human?: number;
  predictedHalfLife_human?: number;
  backPredictions: BackPrediction[];
  AAFE_CL?: number;
  AAFE_Vss?: number;
  warnings: Warning[];
}

export interface BackPrediction {
  species: Species;
  label: string;
  bodyWeight_kg: number;
  CL_observed?: number;
  CL_predicted?: number;
  CL_PE_pct?: number;
  CL_foldError?: number;
  Vss_observed?: number;
  Vss_predicted?: number;
  Vss_PE_pct?: number;
  Vss_foldError?: number;
}

export interface AllometryResults {
  methodResults: AllometrySingleMethodResult[];
  methodRanking: MethodRankEntry[];
  warnings: Warning[];
}

export interface MethodRankEntry {
  method: AllometryMethod;
  label: string;
  predictedCL?: number;
  predictedVss?: number;
  AAFE_CL?: number;
  AAFE_Vss?: number;
  rank_CL?: number;
  rank_Vss?: number;
  notes?: string;
}

export type AllometrySessionResult = SessionResult<AllometryInputs, AllometryResults>;

// ---------------------------------------------------------------------------
// MODULE 2 — IVIVE TYPES
// ---------------------------------------------------------------------------

export type IVIVEModel =
  | 'well_stirred_no_binding'
  | 'well_stirred_with_binding'
  | 'parallel_tube'
  | 'poulin_binding_aware'
  | 'dispersion';

export interface IVIVEModelConfig {
  id: IVIVEModel;
  label: string;
  description: string;
  equations: string[];
  assumptions: string[];
  requiresFuB: boolean;
  requiresFumic: boolean;
  provenance: string;
}

export type IVIVEDataSource = 'microsomes' | 'hepatocytes';

export interface IVIVECompoundInputs {
  compound: CompoundMetadata;
  CLint_app: number;               // apparent intrinsic clearance (µL/min/mg protein or µL/min/10^6 cells)
  CLint_source: IVIVEDataSource;
  fup: number;                     // unbound plasma fraction
  fumic?: number;                  // unbound fraction in microsomes
  fuhep?: number;                  // unbound fraction in hepatocytes
  BP_ratio: number;                // blood-to-plasma ratio
  apply_fumic_correction: boolean;
  observed_CLh?: number;           // optional: observed hepatic CL for comparison
  CL_units: string;
}

export interface IVIVESpeciesInputs {
  species: Species;
  label: string;
  bodyWeight_kg: number;
  liverWeight_g: number;
  MPPGL: number;
  HPGL: number;
  Qh_mL_min: number;              // hepatic blood flow
  include: boolean;
  // override physiology DB
  overrideLiverWeight?: boolean;
  overrideMPPGL?: boolean;
  overrideHPGL?: boolean;
  overrideQh?: boolean;
}

export interface IVIVEInputs {
  compound: IVIVECompoundInputs;
  speciesData: IVIVESpeciesInputs[];
  modelsSelected: IVIVEModel[];
  CLint_units: string;
}

export interface IVIVEModelOutput {
  model: IVIVEModel;
  label: string;
  CLint_invivo_scaled: number;     // scaled intrinsic CL (mL/min)
  CLh_predicted: number;           // predicted hepatic CL (mL/min)
  CLh_predicted_perKg: number;
  Eh: number;                      // extraction ratio
  ExtractionCategory: 'low' | 'medium' | 'high';
  foldError?: number;
  CLobs?: number;
  warnings: Warning[];
}

export interface IVIVESpeciesResult {
  species: Species;
  label: string;
  CLint_invivo: number;            // scaled intrinsic CL
  modelOutputs: IVIVEModelOutput[];
  Qh: number;
  warnings: Warning[];
}

export interface IVIVEResults {
  speciesResults: IVIVESpeciesResult[];
  humanResult?: IVIVESpeciesResult;
  warnings: Warning[];
}

export type IVIVESessionResult = SessionResult<IVIVEInputs, IVIVEResults>;

// ---------------------------------------------------------------------------
// MODULE 3 — DDI TYPES
// ---------------------------------------------------------------------------

export type CYPEnzyme =
  | 'CYP1A2'
  | 'CYP2B6'
  | 'CYP2C8'
  | 'CYP2C9'
  | 'CYP2C19'
  | 'CYP2D6'
  | 'CYP3A4'
  | 'CYP3A5'
  | 'other';

export type Transporter =
  | 'P-gp'
  | 'BCRP'
  | 'OATP1B1'
  | 'OATP1B3'
  | 'OAT1'
  | 'OAT3'
  | 'OCT2'
  | 'MATE1'
  | 'MATE2K';

export type DDIRiskLevel = 'no_risk' | 'potential_risk' | 'risk' | 'high_risk';

export interface SubstratePathway {
  enzyme: CYPEnzyme | Transporter;
  fm: number;               // fraction metabolized / transported
  isSensitive?: boolean;    // sensitive substrate flag
  isMajor?: boolean;        // major substrate flag (fm ≥ 0.25 or 0.50)
}

export interface ReversibleInhibitorData {
  enzyme: CYPEnzyme | Transporter;
  Ki?: number;              // µM unbound
  IC50?: number;            // µM
  Iu_max?: number;          // maximum unbound inhibitor concentration (µM)
  Iu_inlet?: number;        // hepatic inlet concentration (µM)
  mechanism: 'competitive' | 'non_competitive' | 'uncompetitive' | 'mixed' | 'unknown';
  IC50_to_Ki_ratio?: number; // default 2 for competitive
}

export interface TDIData {
  enzyme: CYPEnzyme;
  kinact: number;           // h⁻¹
  KI: number;               // µM
  Iu_max: number;           // µM
  kdeg: number;             // h⁻¹ (from physiology DB)
  source?: string;
}

export interface InductionData {
  enzyme: CYPEnzyme;
  Emax: number;             // fold
  EC50: number;             // µM
  Iu_max: number;           // µM
  d?: number;               // degradation scaling (default 1)
}

export interface TransporterInhibitionData {
  transporter: Transporter;
  IC50?: number;            // µM
  Ki?: number;              // µM
  Iu_gut?: number;          // gut lumen concentration for intestinal transporters
  Iu_systemic?: number;     // unbound systemic concentration
  threshold_R?: number;     // regulatory threshold for R value
  threshold_concentration?: number;
}

export interface DDIInputs {
  compound: CompoundMetadata;
  // substrate assessment
  substratePathways: SubstratePathway[];
  // inhibition
  reversibleInhibitors: ReversibleInhibitorData[];
  tdiData: TDIData[];
  induction: InductionData[];
  // transporter
  transporterInhibition: TransporterInhibitionData[];
  // concentration data
  Cmax_total?: number;      // µM
  Cmax_unbound?: number;    // µM
  dose_mg?: number;
  bioavailability_F?: number;
  dosingInterval_h?: number;
  useInletConcentration: boolean;
  fabs?: number;
  Qgut_mL_min?: number;    // gut blood flow (default 18 mL/min)
}

export interface DDIPathwayResult {
  pathway: string;
  metric_name: string;
  metric_value: number;
  threshold: number;
  risk: DDIRiskLevel;
  rationale: string;
  equation: string;
  confidence: 'high' | 'medium' | 'low';
  warnings: Warning[];
}

export interface DDIResults {
  substrateResults: SubstrateResult[];
  reversibleInhibitionResults: DDIPathwayResult[];
  TDIResults: DDIPathwayResult[];
  inductionResults: DDIPathwayResult[];
  transporterResults: DDIPathwayResult[];
  overallRisk: DDIRiskLevel;
  riskMatrix: RiskMatrixEntry[];
  warnings: Warning[];
}

export interface SubstrateResult {
  enzyme: CYPEnzyme | Transporter;
  fm: number;
  AUCR_max_inhibition?: number;
  isSensitive: boolean;
  isMajor: boolean;
  riskLevel: DDIRiskLevel;
  note: string;
}

export interface RiskMatrixEntry {
  pathway: string;
  type: 'substrate' | 'reversible' | 'TDI' | 'induction' | 'transporter';
  risk: DDIRiskLevel;
  metric?: number;
  threshold?: number;
}

export type DDISessionResult = SessionResult<DDIInputs, DDIResults>;

// ---------------------------------------------------------------------------
// DDI TAB F — MECHANISTIC STATIC MODEL TYPES
// ---------------------------------------------------------------------------

export interface MechanisticStaticEnzymeInputs {
  enzyme: CYPEnzyme;
  fm: number;                  // fraction metabolized by this enzyme (for AUCR)
  // Reversible inhibition
  useReversible: boolean;
  Ki_rev?: number;             // µM unbound
  Iu_rev?: number;             // µM (systemic unbound or hepatic inlet)
  // TDI
  useTDI: boolean;
  kinact?: number;             // h⁻¹
  KI_tdi?: number;             // µM
  Iu_tdi?: number;             // µM
  kdeg: number;                // h⁻¹ from physiology DB
  // Induction
  useInduction: boolean;
  Emax?: number;               // fold
  EC50_ind?: number;           // µM
  Iu_ind?: number;             // µM
}

export interface MechanisticStaticIntermediate {
  // Reversible
  R_rev?: number;              // 1 + Iu/Ki
  activity_rev?: number;       // 1/R_rev = Ki/(Ki+Iu)
  // TDI
  lambda?: number;             // kinact × Iu/(KI + Iu)
  R_TDI?: number;              // (kdeg + λ)/kdeg
  activity_TDI?: number;       // 1/R_TDI
  // Induction
  fold_induction?: number;     // 1 + Emax × Iu/(EC50 + Iu)
  // Combined
  net_activity_ratio: number;  // fold_ind / (R_rev × R_TDI)
  AUCR?: number;               // 1/[fm × (1/net) + (1-fm)]
}

export interface MechanisticStaticEnzymeResult {
  enzyme: CYPEnzyme;
  intermediates: MechanisticStaticIntermediate;
  risk: DDIRiskLevel;
  riskLabel: string;
  warnings: Warning[];
}

export interface MechanisticStaticInputs {
  compound: CompoundMetadata;
  template: 'FDA_2020' | 'EMA_2012' | 'custom';
  enzymes: MechanisticStaticEnzymeInputs[];
}

export interface MechanisticStaticResults {
  enzymeResults: MechanisticStaticEnzymeResult[];
  overallRisk: DDIRiskLevel;
  warnings: Warning[];
}

// ---------------------------------------------------------------------------
// BATCH IVIVE TYPES
// ---------------------------------------------------------------------------

export interface BatchIVIVERecord {
  compound_name: string;
  CLint_app: number;
  CLint_source: IVIVEDataSource;
  fup: number;
  fumic?: number;
  fuhep?: number;
  BP_ratio: number;
  apply_fumic_correction: boolean;
  observed_CLh?: number;
  comments?: string;
}

export interface BatchIVIVEResult {
  compound_name: string;
  inputs: BatchIVIVERecord;
  results: IVIVEResults;
  warnings: Warning[];
}

// ---------------------------------------------------------------------------
// BATCH DDI TYPES
// ---------------------------------------------------------------------------

export interface BatchDDIRecord {
  compound_name: string;
  enzyme_or_transporter: string;
  pathway_type: 'substrate' | 'reversible_inhibitor' | 'TDI' | 'inducer' | 'transporter_inhibitor';
  fm?: number;
  Ki?: number;
  IC50?: number;
  kinact?: number;
  KI?: number;
  Emax?: number;
  EC50?: number;
  concentration_metric_type?: string;
  concentration_value?: number;
  unbound_fraction?: number;
  comments?: string;
}

export interface BatchDDIResult {
  compound_name: string;
  inputs: BatchDDIRecord[];
  results: DDIResults;
  warnings: Warning[];
}

// ---------------------------------------------------------------------------
// MODULE 4 — REPORTING TYPES
// ---------------------------------------------------------------------------

export type ExportFormat = 'pdf' | 'html' | 'json' | 'markdown';

export interface ReportConfig {
  title: string;
  compoundName: string;
  projectCode?: string;
  author?: string;
  organization?: string;
  date: string;
  includeEquations: boolean;
  includeIntermediates: boolean;
  includeWarnings: boolean;
  includeAssumptions: boolean;
  includePlots: boolean;
  includeAppendix: boolean;
  modulesToInclude: ModuleType[];
  exportFormats: ExportFormat[];
  disclaimer: string;
}

export interface UploadedSession {
  moduleType: ModuleType;
  result: AllometrySessionResult | IVIVESessionResult | DDISessionResult;
  filename: string;
  uploadedAt: string;
}

export interface ScenarioComparison {
  id: string;
  label: string;
  sessions: UploadedSession[];
  createdAt: string;
}
