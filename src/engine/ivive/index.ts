/**
 * IVIVE module orchestrator.
 *
 * Scales in-vitro intrinsic clearance to in-vivo hepatic clearance for each
 * selected species using all selected hepatic clearance models.
 */

import type {
  IVIVECompoundInputs,
  IVIVEInputs,
  IVIVEModel,
  IVIVEModelOutput,
  IVIVEPerSpeciesCompound,
  IVIVEResults,
  IVIVESpeciesInputs,
  IVIVESpeciesResult,
  Warning,
} from '@/types';


import {
  scaleCLint_microsomal,
  scaleCLint_hepatocyte,
  applyCLint_fu_correction,
  wellStirredNoBind,
  wellStirredWithBind,
  parallelTube,
  poulinMethod,
  dispersionModel,
  extractionRatio,
  categorizeExtraction,
  IVIVE_MODEL_CONFIGS,
} from './models';

function foldError(predicted: number, observed: number): number {
  if (observed === 0) return NaN;
  return predicted / observed;
}

// ---------------------------------------------------------------------------
// SINGLE SPECIES COMPUTATION
// ---------------------------------------------------------------------------

/**
 * Compute IVIVE result for a single species across all selected models.
 *
 * @param compoundInputs  Compound-level PK inputs (CLint, fup, BP ratio, etc.)
 * @param speciesInputs   Species physiology (MPPGL/HPGL, liver weight, Qh)
 * @param models          Array of IVIVE model IDs to evaluate
 */
export function computeSpeciesIVIVE(
  compoundInputs: IVIVECompoundInputs,
  speciesInputs: IVIVESpeciesInputs,
  models: IVIVEModel[],
): IVIVESpeciesResult {
  const warnings: Warning[] = [];

  const { CLint_app, CLint_source, fup, fumic, fuhep, BP_ratio, apply_fumic_correction, observed_CLh } =
    compoundInputs;
  const { species, label, bodyWeight_kg, liverWeight_g, MPPGL, HPGL, Qh_mL_min } = speciesInputs;

  // ---------- Step 1: Scale CLint to in vivo ----------
  let CLint_invivo: number;

  if (CLint_source === 'microsomes') {
    CLint_invivo = scaleCLint_microsomal(CLint_app, MPPGL, liverWeight_g);
  } else {
    CLint_invivo = scaleCLint_hepatocyte(CLint_app, HPGL, liverWeight_g);
  }

  // ---------- Step 2: fu correction ----------
  if (apply_fumic_correction) {
    if (CLint_source === 'microsomes') {
      if (fumic !== undefined && fumic > 0 && fumic <= 1) {
        CLint_invivo = applyCLint_fu_correction(CLint_invivo, fumic);
      } else {
        warnings.push({
          code: 'MISSING_FUMIC',
          message: 'fumic correction requested but fumic not provided or invalid; skipping fu correction.',
          severity: 'caution',
        });
      }
    } else {
      if (fuhep !== undefined && fuhep > 0 && fuhep <= 1) {
        CLint_invivo = applyCLint_fu_correction(CLint_invivo, fuhep);
      } else {
        warnings.push({
          code: 'MISSING_FUHEP',
          message: 'fuhep correction requested but fuhep not provided or invalid; skipping fu correction.',
          severity: 'caution',
        });
      }
    }
  }

  // ---------- Step 3: Derived quantities ----------
  const fuB = fup / BP_ratio;
  if (fuB > 1) {
    warnings.push({
      code: 'FUB_GT_1',
      message: `fuB = fup/BP_ratio = ${fuB.toFixed(3)} > 1; capped at 1 for model calculations.`,
      severity: 'caution',
    });
  }
  const fuB_capped = Math.min(fuB, 1);

  // ---------- Step 4: Run each model ----------
  const modelOutputs: IVIVEModelOutput[] = [];

  for (const modelId of models) {
    const modelCfg = IVIVE_MODEL_CONFIGS[modelId];
    const modelWarnings: Warning[] = [];
    let CLh: number;

    try {
      switch (modelId) {
        case 'well_stirred_no_binding':
          CLh = wellStirredNoBind(Qh_mL_min, CLint_invivo);
          break;

        case 'well_stirred_with_binding':
          CLh = wellStirredWithBind(Qh_mL_min, fuB_capped, CLint_invivo);
          break;

        case 'parallel_tube':
          CLh = parallelTube(Qh_mL_min, fuB_capped, CLint_invivo);
          break;

        case 'poulin_binding_aware':
          CLh = poulinMethod(Qh_mL_min, fup, BP_ratio, CLint_invivo);
          break;

        case 'dispersion':
          CLh = dispersionModel(Qh_mL_min, fuB_capped, CLint_invivo);
          break;

        default:
          modelWarnings.push({
            code: 'UNKNOWN_MODEL',
            message: `Unknown IVIVE model "${modelId}" skipped.`,
            severity: 'warning',
          });
          CLh = NaN;
      }
    } catch (err) {
      CLh = NaN;
      modelWarnings.push({
        code: 'MODEL_ERROR',
        message: `Model "${modelId}" failed: ${err instanceof Error ? err.message : String(err)}`,
        severity: 'error',
      });
    }

    const Eh = isNaN(CLh) ? NaN : extractionRatio(CLh, Qh_mL_min);
    const category = isNaN(Eh) ? 'low' : categorizeExtraction(Eh);
    const CLh_perKg = bodyWeight_kg > 0 ? CLh / bodyWeight_kg : NaN;

    const output: IVIVEModelOutput = {
      model:                  modelId,
      label:                  modelCfg.label,
      CLint_invivo_scaled:    CLint_invivo,
      CLh_predicted:          CLh,
      CLh_predicted_perKg:    CLh_perKg,
      Eh,
      ExtractionCategory:     category,
      warnings:               modelWarnings,
    };

    if (observed_CLh !== undefined && observed_CLh > 0 && !isNaN(CLh)) {
      output.CLobs     = observed_CLh;
      output.foldError = foldError(CLh, observed_CLh);
    }

    modelOutputs.push(output);
  }

  return {
    species,
    label,
    CLint_invivo,
    modelOutputs,
    Qh: Qh_mL_min,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// MAIN ORCHESTRATOR
// ---------------------------------------------------------------------------

/**
 * Main IVIVE calculation entry point.
 *
 * Iterates over all included species, calls computeSpeciesIVIVE for each,
 * and returns consolidated IVIVEResults.
 */
export function runIVIVE(inputs: IVIVEInputs): IVIVEResults {
  const warnings: Warning[] = [];

  const { compound, speciesData, modelsSelected } = inputs;

  if (speciesData.length === 0) {
    warnings.push({
      code: 'NO_SPECIES',
      message: 'No species data provided for IVIVE.',
      severity: 'error',
    });
    return { speciesResults: [], warnings };
  }

  if (modelsSelected.length === 0) {
    warnings.push({
      code: 'NO_MODELS',
      message: 'No IVIVE models selected.',
      severity: 'error',
    });
    return { speciesResults: [], warnings };
  }

  // Validate compound inputs — skip global validation when per-species data overrides all species
  const hasPerSpecies = inputs.perSpeciesCompound && inputs.perSpeciesCompound.length > 0;
  if (!hasPerSpecies) {
    if (compound.CLint_app <= 0) {
      warnings.push({
        code: 'INVALID_CLINT',
        message: `CLint_app must be positive (got ${compound.CLint_app}).`,
        severity: 'error',
      });
    }
    if (compound.fup <= 0 || compound.fup > 1) {
      warnings.push({
        code: 'INVALID_FUP',
        message: `fup must be in (0, 1] (got ${compound.fup}).`,
        severity: 'error',
      });
    }
    if (compound.BP_ratio <= 0) {
      warnings.push({
        code: 'INVALID_BP',
        message: `BP_ratio must be positive (got ${compound.BP_ratio}).`,
        severity: 'error',
      });
    }
  }

  const includedSpecies = speciesData.filter(s => s.include);
  if (includedSpecies.length === 0) {
    warnings.push({
      code: 'NO_INCLUDED_SPECIES',
      message: 'No species are marked as included.',
      severity: 'error',
    });
    return { speciesResults: [], warnings };
  }

  const speciesResults: IVIVESpeciesResult[] = [];
  let humanResult: IVIVESpeciesResult | undefined;

  for (const sp of includedSpecies) {
    try {
      // Merge per-species compound overrides when available
      const perSp = inputs.perSpeciesCompound?.find(p => p.species === sp.species);
      const compoundForSpecies: IVIVECompoundInputs = perSp
        ? { ...compound, CLint_app: perSp.CLint_app, fup: perSp.fup, BP_ratio: perSp.BP_ratio, observed_CLh: perSp.observed_CLh }
        : compound;
      const result = computeSpeciesIVIVE(compoundForSpecies, sp, modelsSelected);
      speciesResults.push(result);
      if (sp.species === 'human') {
        humanResult = result;
      }
    } catch (err) {
      warnings.push({
        code: 'SPECIES_IVIVE_FAILED',
        message: `IVIVE failed for "${sp.label}": ${err instanceof Error ? err.message : String(err)}`,
        severity: 'error',
      });
    }
  }

  return {
    speciesResults,
    humanResult,
    warnings,
  };
}

// Re-export model utilities for consumers
export {
  scaleCLint_microsomal,
  scaleCLint_hepatocyte,
  applyCLint_fu_correction,
  wellStirredNoBind,
  wellStirredWithBind,
  parallelTube,
  poulinMethod,
  dispersionModel,
  extractionRatio,
  categorizeExtraction,
  IVIVE_MODEL_CONFIGS,
};
