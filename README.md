# ClinPharm Toolkit

**Production-ready clinical pharmacology prediction platform** for DMPK, Clin Pharm, and PMX scientists.

> **Disclaimer:** All outputs are exploratory and assumption-dependent. For research and internal decision-making only. Not for regulatory submissions without additional validation.

---

## Modules

| Module | Purpose |
|--------|---------|
| **Allometric Scaling** | Predict human CL and Vss from multi-species animal PK data using regression-based allometric methods |
| **IVIVE** | In vitro to in vivo extrapolation of hepatic clearance from microsomal or hepatocyte data |
| **DDI Assessment** | Drug-drug interaction risk: substrate assessment, reversible inhibition, TDI, induction, transporter inhibition |
| **Reporting** | Upload prior session results, generate HTML/PDF/JSON reports, scenario comparison |

---

## Quick Start

```bash
npm install
npm run dev        # development server (http://localhost:5173)
npm run build      # production build
npm test           # run test suite
npm run typecheck  # TypeScript check
```

---

## Stack

- **React 18** + TypeScript + Vite
- **Tailwind CSS 3** for styling
- **Plotly.js** (react-plotly.js) for scientific charts
- **Zustand** for state management
- **Radix UI** primitives (Tabs, Accordion, Select, etc.)
- **jsPDF** + html2canvas for PDF export
- **xlsx** + PapaParse for CSV/XLSX import
- **Vitest** + Testing Library for tests

---

## Architecture

```
src/
├── types/           # Central TypeScript interfaces (contract between all layers)
│   └── index.ts
├── engine/          # Pure calculation functions — NO React dependencies
│   ├── allometry/
│   │   ├── regression.ts    # OLS log-log regression, AAFE, PE%
│   │   ├── methods.ts       # 15+ allometric method implementations
│   │   ├── validation.ts    # Input validation and warnings
│   │   └── index.ts         # runAllometry() orchestrator
│   ├── ivive/
│   │   ├── models.ts        # Well-stirred, parallel tube, Poulin scaling
│   │   └── index.ts         # runIVIVE() orchestrator
│   ├── ddi/
│   │   ├── substrate.ts     # fm-based AUCR assessment
│   │   ├── inhibition.ts    # R1, R2, TDI calculations
│   │   ├── induction.ts     # Emax fold-induction model
│   │   ├── transporters.ts  # Transporter R values and thresholds
│   │   └── index.ts         # runDDI() orchestrator
│   └── units/
│       └── index.ts         # Unit conversion utilities
├── data/
│   ├── physiology.ts        # Species physiological database (10 species)
│   ├── formulas.ts          # Formula registry (28+ entries with citations)
│   └── samples/             # Pre-loaded example datasets
├── components/
│   ├── shared/              # WarningBox, DataTable, EquationPanel, etc.
│   ├── dashboard/           # Home page with module cards
│   ├── allometry/           # AllometryModule, SpeciesInputTable, Plots
│   ├── ivive/               # IVIVEModule, CompoundPanel, SpeciesTable
│   ├── ddi/                 # DDIModule (5-tab interface)
│   └── reporting/           # ReportingModule (upload + generate)
├── store/
│   └── index.ts             # Zustand global state
└── utils/
    ├── session.ts           # Serialize/deserialize session results
    ├── export.ts            # PDF, HTML, CSV, JSON export
    └── csvImport.ts         # CSV/XLSX parsing utilities
tests/
├── setup.ts
└── engine/
    ├── regression.test.ts
    ├── allometry.test.ts
    ├── ivive.test.ts
    ├── ddi.test.ts
    └── units.test.ts
samples/
├── allometry-input.csv
├── ivive-input.csv
└── ddi-input.csv
```

---

## Where Each Equation Is Implemented

### Allometric Scaling

| Equation | File | Function |
|----------|------|---------|
| `P = a × BW^b` | `engine/allometry/regression.ts` | `fitAllometricRegression` |
| `ln(P) = ln(a) + b×ln(BW)` | `engine/allometry/regression.ts` | `fitAllometricRegression` |
| `PE% = 100×(pred-obs)/obs` | `engine/allometry/regression.ts` | `computePE` |
| `AAFE = 10^[mean(|log10(P/O)|)]` | `engine/allometry/regression.ts` | `computeAAFE` |
| Simple allometry | `engine/allometry/methods.ts` | `simpleAllometry` |
| Unbound fraction correction `CLu = CL/fup` | `engine/allometry/methods.ts` | `unboundFractionAllometry` |
| Brain weight (Boxenbaum 1982) | `engine/allometry/methods.ts` | `brainWeightAllometry` |
| MLP correction (Boxenbaum 1982) | `engine/allometry/methods.ts` | `MLPAllometry` |
| Caldwell–Tang 1 (MLP + fup) | `engine/allometry/methods.ts` | `caldwellTang1` |
| Caldwell–Tang 2 (BrW + fup) | `engine/allometry/methods.ts` | `caldwellTang2` |
| Fixed exponent (b = 0.75, 0.85, 1.0) | `engine/allometry/methods.ts` | `fixedExponentAllometry` |
| Leave-one-out CV | `engine/allometry/methods.ts` | `leaveOneOut` |
| Rule of exponent | `engine/allometry/methods.ts` | `ruleOfExponent` |

### IVIVE

| Equation | File | Function |
|----------|------|---------|
| `CLint,invivo = CLint,mic × MPPGL × LW / 1000` | `engine/ivive/models.ts` | `scaleCLint_microsomal` |
| `CLint,invivo = CLint,hep × HPGL × LW / 1000` | `engine/ivive/models.ts` | `scaleCLint_hepatocyte` |
| `fuB = fup / BP_ratio` | `engine/ivive/models.ts` | (inline in each model) |
| Well-stirred (no binding): `CLh = Qh×CLint/(Qh+CLint)` | `engine/ivive/models.ts` | `wellStirredNoBind` |
| Well-stirred (with binding): `CLh = Qh×fuB×CLint/(Qh+fuB×CLint)` | `engine/ivive/models.ts` | `wellStirredWithBind` |
| Parallel tube: `CLh = Qh×[1-exp(-fuB×CLint/Qh)]` | `engine/ivive/models.ts` | `parallelTube` |
| Poulin binding-aware | `engine/ivive/models.ts` | `poulinMethod` |
| `Eh = CLh / Qh` | `engine/ivive/models.ts` | `extractionRatio` |

### DDI Assessment

| Equation | File | Function |
|----------|------|---------|
| `AUCR_max = 1/(1-fm)` | `engine/ddi/substrate.ts` | `AUCR_complete_inhibition` |
| `AUCR = 1/[(1-fm) + fm/IF]` | `engine/ddi/substrate.ts` | `AUCR_partial` |
| `R1 = 1 + Iu/Ki` | `engine/ddi/inhibition.ts` | `R1_ratio` |
| `Ki ≈ IC50/2` | `engine/ddi/inhibition.ts` | `Ki_from_IC50` |
| `λ = kinact×Iu/(KI+Iu)` | `engine/ddi/inhibition.ts` | `TDI_lambda` |
| `R2 = (kdeg+λ)/kdeg` | `engine/ddi/inhibition.ts` | `R2_ratio` |
| `Fold = 1 + Emax×I/(EC50+I)` | `engine/ddi/induction.ts` | `foldInduction` |
| Transporter R values | `engine/ddi/transporters.ts` | `transporterR`, `assessTransporterInhibition` |

---

## Physiological Database

**Version:** 1.0.0 | **Source:** `src/data/physiology.ts`

Species: Mouse, Rat, Rabbit, Guinea pig, Hamster, Dog, Monkey (rhesus), Cynomolgus monkey, Minipig, Human

Parameters: Body weight, liver weight, MPPGL, HPGL, hepatic blood flow, brain weight, MLP, CYP kdeg values.

**Primary references:**
- Davies B & Morris T (1993). *Pharm Res* 10(7):1093–1095
- Barter ZE et al. (2007). *Curr Drug Metab* 8(1):33–45
- Houston JB & Carlile DJ (1997). *Drug Metab Rev* 29(4):891–922

---

## Formula Registry

All 28+ formulas are documented at `src/data/formulas.ts` with:
- Plain-text and LaTeX equations
- Variable definitions with units and typical ranges
- Assumptions
- Literature citations (Boxenbaum, Obach, Rowland, Poulin, EMA/FDA guidance, etc.)

---

## Session Result Schema

All module outputs follow this JSON schema:

```json
{
  "metadata": {
    "runId": "uuid",
    "timestamp": "ISO-8601",
    "appType": "allometry|ivive|ddi",
    "appVersion": "1.0.0",
    "formulaSetVersion": "1.0.0",
    "physiologyVersion": "1.0.0"
  },
  "compound": { "name": "...", "MW": 0, "logP": 0 },
  "inputs": { "...module-specific..." },
  "methodsSelected": ["..."],
  "intermediateResults": {},
  "finalResults": { "...module-specific..." },
  "warnings": [{ "code": "...", "message": "...", "severity": "info|caution|warning|error" }],
  "assumptions": ["..."],
  "units": { "CL": "mL/min", "Vss": "L" }
}
```

Re-upload any exported `.json` file in the Reporting module to reconstruct the session.

---

## Sample Input Templates

| File | Contents |
|------|---------|
| `samples/allometry-input.csv` | 5-species allometry dataset (mouse, rat, dog, monkey, cynomolgus) |
| `samples/ivive-input.csv` | 3-species IVIVE physiology table (rat, dog, human) |
| `samples/ddi-input.csv` | DDI example with substrate, reversible inhibitor, TDI, and transporter data |

---

## Testing

```bash
npm test                    # Run all tests
npm run test:coverage       # With coverage report
npm run test:watch          # Watch mode
```

Test files in `tests/engine/`:
- `regression.test.ts` — OLS regression, AAFE, PE% calculations
- `allometry.test.ts` — Full allometry workflow integration tests
- `ivive.test.ts` — IVIVE model equations and workflow
- `ddi.test.ts` — DDI substrate, inhibition, TDI, induction, transporter calculations
- `units.test.ts` — Unit conversion utilities

---

## Regulatory Context

This tool implements static mechanistic frameworks from:
- **FDA** *In Vitro Drug Interaction Studies* Guidance (2020)
- **EMA** *Guideline on the Investigation of Drug Interactions* (2012)
- **ICH M12** Drug Interaction Studies Guideline (2022)

DDI thresholds implemented:
- Reversible inhibition: EMA R1 ≥ 1.02; FDA R1 ≥ 1.1
- TDI: R2 ≥ 1.25
- Induction: fold-change ≥ 2×
- Transporters: P-gp/BCRP (gut) ≥ 10; OATP1B1/1B3 ≥ 0.1; OAT1/3 ≥ 0.1; OCT2/MATE1/2K ≥ 0.02

**Important:** PBPK modeling or clinical DDI studies may still be required even when static assessments suggest no risk.
