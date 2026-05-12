/**
 * Batch IVIVE runner.
 *
 * Accepts an array of compound-level BatchIVIVERecord objects and runs the
 * IVIVE engine for each compound, returning a BatchIVIVEResult per record.
 */

import { runIVIVE } from './index';
import type {
  IVIVEInputs,
  IVIVEModel,
  IVIVESpeciesInputs,
  BatchIVIVERecord,
  BatchIVIVEResult,
} from '@/types';
import { IVIVE_SAMPLE } from '@/data/samples';

const DEFAULT_MODELS: IVIVEModel[] = [
  'well_stirred_no_binding',
  'well_stirred_with_binding',
  'parallel_tube',
];

export function runBatchIVIVE(
  records: BatchIVIVERecord[],
  speciesData?: IVIVESpeciesInputs[],
  modelsSelected?: string[],
): BatchIVIVEResult[] {
  const resolvedSpecies: IVIVESpeciesInputs[] =
    speciesData && speciesData.length > 0 ? speciesData : IVIVE_SAMPLE.speciesData;

  const resolvedModels: IVIVEModel[] =
    modelsSelected && modelsSelected.length > 0
      ? (modelsSelected as IVIVEModel[])
      : DEFAULT_MODELS;

  return records.map(record => {
    const inputs: IVIVEInputs = {
      compound: {
        compound: { name: record.compound_name },
        CLint_app: record.CLint_app,
        CLint_source: record.CLint_source,
        fup: record.fup,
        fumic: record.fumic,
        fuhep: record.fuhep,
        BP_ratio: record.BP_ratio,
        apply_fumic_correction: record.apply_fumic_correction,
        observed_CLh: record.observed_CLh,
        CL_units: 'mL/min',
      },
      speciesData: resolvedSpecies,
      modelsSelected: resolvedModels,
      CLint_units:
        record.CLint_source === 'microsomes'
          ? 'µL/min/mg'
          : 'µL/min/10^6 cells',
    };

    const results = runIVIVE(inputs);

    return {
      compound_name: record.compound_name,
      inputs: record,
      results,
      warnings: results.warnings,
    };
  });
}
