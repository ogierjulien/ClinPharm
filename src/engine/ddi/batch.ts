/**
 * Batch DDI engine.
 *
 * Groups BatchDDIRecord[] by compound_name, constructs DDIInputs for each
 * compound, delegates to runDDI(), and returns BatchDDIResult[].
 */

import { runDDI } from './index';
import type {
  DDIInputs,
  BatchDDIRecord,
  BatchDDIResult,
  CompoundMetadata,
  CYPEnzyme,
  Transporter,
  SubstratePathway,
  ReversibleInhibitorData,
  TDIData,
  InductionData,
  TransporterInhibitionData,
} from '@/types';

// ---------------------------------------------------------------------------
// kdeg defaults by enzyme (h⁻¹) — Yang et al. 2008 DMD
// ---------------------------------------------------------------------------

const KDEG_DEFAULTS: Record<string, number> = {
  CYP3A4:  0.0193,
  CYP2D6:  0.0088,
  CYP2C9:  0.0148,
  CYP2C19: 0.0148,
  CYP1A2:  0.0208,
  CYP2B6:  0.0096,
  CYP2C8:  0.0213,
};

function kdegForEnzyme(enzyme: string): number {
  return KDEG_DEFAULTS[enzyme] ?? 0.02;
}

// ---------------------------------------------------------------------------
// Build DDIInputs from a group of records for one compound
// ---------------------------------------------------------------------------

function buildDDIInputsFromRecords(
  compoundName: string,
  records: BatchDDIRecord[],
): DDIInputs {
  const compound: CompoundMetadata = { name: compoundName };

  const substratePathways: SubstratePathway[] = [];
  const reversibleInhibitors: ReversibleInhibitorData[] = [];
  const tdiData: TDIData[] = [];
  const induction: InductionData[] = [];
  const transporterInhibition: TransporterInhibitionData[] = [];

  for (const rec of records) {
    const enzyme = rec.enzyme_or_transporter;
    const Iu = rec.concentration_value;

    switch (rec.pathway_type) {
      case 'substrate': {
        substratePathways.push({
          enzyme: enzyme as CYPEnzyme | Transporter,
          fm:     rec.fm ?? 0,
        });
        break;
      }

      case 'reversible_inhibitor': {
        reversibleInhibitors.push({
          enzyme:    enzyme as CYPEnzyme | Transporter,
          Ki:        rec.Ki,
          IC50:      rec.IC50,
          Iu_max:    Iu,
          mechanism: 'unknown',
        });
        break;
      }

      case 'TDI': {
        tdiData.push({
          enzyme:  enzyme as CYPEnzyme,
          kinact:  rec.kinact ?? 0,
          KI:      rec.KI ?? 1,
          Iu_max:  Iu ?? 0,
          kdeg:    kdegForEnzyme(enzyme),
        });
        break;
      }

      case 'inducer': {
        induction.push({
          enzyme:  enzyme as CYPEnzyme,
          Emax:    rec.Emax ?? 0,
          EC50:    rec.EC50 ?? 1,
          Iu_max:  Iu ?? 0,
        });
        break;
      }

      case 'transporter_inhibitor': {
        transporterInhibition.push({
          transporter:  enzyme as Transporter,
          IC50:         rec.IC50 ?? rec.Ki,
          Ki:           rec.Ki,
          Iu_systemic:  Iu,
        });
        break;
      }
    }
  }

  return {
    compound,
    mmKinetics: [],
    substratePathways,
    reversibleInhibitors,
    tdiData,
    induction,
    transporterInhibition,
    useInletConcentration: false,
  };
}

// ---------------------------------------------------------------------------
// Main batch runner
// ---------------------------------------------------------------------------

/**
 * Run DDI assessment for a batch of records.
 *
 * Records are grouped by compound_name. For each group, a DDIInputs object is
 * constructed from the pathway-typed rows and passed to runDDI().
 *
 * @param records  BatchDDIRecord[] — typically the output of parseDDIBatchCSV()
 * @returns        BatchDDIResult[] — one result per unique compound_name
 */
export function runBatchDDI(records: BatchDDIRecord[]): BatchDDIResult[] {
  // Group records by compound_name (preserving order of first occurrence)
  const groups = new Map<string, BatchDDIRecord[]>();
  for (const rec of records) {
    const key = rec.compound_name;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(rec);
  }

  const results: BatchDDIResult[] = [];

  for (const [compoundName, recs] of groups) {
    const inputs = buildDDIInputsFromRecords(compoundName, recs);
    let ddiResults;
    const warnings = [];
    try {
      ddiResults = runDDI(inputs);
    } catch (err) {
      // On error, produce a minimal result with a warning
      ddiResults = runDDI({
        compound: { name: compoundName },
        mmKinetics: [],
        substratePathways: [],
        reversibleInhibitors: [],
        tdiData: [],
        induction: [],
        transporterInhibition: [],
        useInletConcentration: false,
      });
      warnings.push({
        code: 'BATCH_RUN_ERROR',
        message: `DDI run failed for ${compoundName}: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'error' as const,
      });
    }

    results.push({
      compound_name: compoundName,
      inputs:        recs,
      results:       ddiResults,
      warnings,
    });
  }

  return results;
}
