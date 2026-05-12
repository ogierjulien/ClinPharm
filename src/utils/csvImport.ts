import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { AnimalDataPoint, IVIVESpeciesInputs, Species } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { PHYSIOLOGY_DB } from '@/data/physiology';

// ---------------------------------------------------------------------------
// CSV / XLSX parsing utilities
// ---------------------------------------------------------------------------

export interface ParsedRow {
  [key: string]: string | number | boolean | null;
}

export async function parseCSV(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<ParsedRow>(file, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete: result => resolve(result.data),
      error: err => reject(new Error(`CSV parse error: ${err.message}`)),
    });
  });
}

export async function parseXLSX(file: File): Promise<ParsedRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<ParsedRow>(ws, { defval: null });
}

export async function parseFile(file: File): Promise<ParsedRow[]> {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return parseCSV(file);
  if (ext === 'xlsx' || ext === 'xls') return parseXLSX(file);
  throw new Error(`Unsupported file type: .${ext}. Use CSV or XLSX.`);
}

// ---------------------------------------------------------------------------
// Allometry CSV → AnimalDataPoint[]
// ---------------------------------------------------------------------------
// Expected columns: species, label, body_weight_kg, CL, Vss, fup, brain_weight_g, MLP_years
// CL and Vss can be absolute or per-kg — add column CL_perkg=true/false

export function parseAllometryCSV(rows: ParsedRow[]): AnimalDataPoint[] {
  return rows.map((row, i) => {
    const species = (String(row.species ?? '')).toLowerCase().replace(/\s+/g, '_') as Species;
    const BW = Number(row.body_weight_kg ?? row.BW_kg ?? row.BW);
    const CL = Number(row.CL ?? row.cl);
    const Vss = Number(row.Vss ?? row.vss ?? row.VSS);
    const perKg = String(row.CL_perkg ?? row.CL_per_kg ?? 'false').toLowerCase() === 'true';

    const CLabs = perKg ? CL * BW : CL;
    const VssAbs = perKg ? Vss * BW : Vss;

    return {
      id: uuidv4(),
      species,
      label: String(row.label ?? row.species ?? `Animal ${i + 1}`),
      bodyWeight_kg: BW,
      CL_observed: CL,
      Vss_observed: Vss,
      fup: row.fup != null ? Number(row.fup) : undefined,
      brainWeight_g: row.brain_weight_g != null ? Number(row.brain_weight_g) : undefined,
      MLP_years: row.MLP_years != null ? Number(row.MLP_years) : undefined,
      include: true,
      CL_perKg_input: perKg,
      Vss_perKg_input: perKg,
      CL_abs: CLabs,
      Vss_abs: VssAbs,
    };
  });
}

// ---------------------------------------------------------------------------
// IVIVE CSV → IVIVESpeciesInputs[]
// ---------------------------------------------------------------------------
// Expected columns: species, body_weight_kg, liver_weight_g, MPPGL, HPGL, Qh_mL_min

export function parseIVIVESpeciesCSV(rows: ParsedRow[]): IVIVESpeciesInputs[] {
  return rows.map(row => {
    const species = (String(row.species ?? '')).toLowerCase().replace(/\s+/g, '_') as Species;
    const phys = PHYSIOLOGY_DB[species];

    return {
      species,
      label: String(row.label ?? row.species),
      bodyWeight_kg: Number(row.body_weight_kg ?? phys?.bodyWeight_kg ?? 70),
      liverWeight_g: Number(row.liver_weight_g ?? phys?.liverWeight_g ?? 1800),
      MPPGL: Number(row.MPPGL ?? phys?.MPPGL ?? 45),
      HPGL: Number(row.HPGL ?? phys?.HPGL ?? 120),
      Qh_mL_min: Number(row.Qh_mL_min ?? phys?.hepaticBloodFlow_mL_min ?? 1500),
      include: true,
    };
  });
}

// ---------------------------------------------------------------------------
// Template generators (for CSV download)
// ---------------------------------------------------------------------------

export function allometryCSVTemplate(): string {
  const headers = 'species,label,body_weight_kg,CL,Vss,fup,brain_weight_g,MLP_years,CL_perkg';
  const examples = [
    'mouse,Mouse,0.02,1.2,0.030,0.12,0.42,3.5,false',
    'rat,Rat,0.25,7.5,0.300,0.10,2.00,4.7,false',
    'dog,Dog,11.3,113.0,10.17,0.15,72.0,20.0,false',
    'monkey,Monkey,5.0,75.0,5.50,0.11,87.0,40.0,false',
    'cynomolgus_monkey,Cynomolgus,4.0,72.0,4.80,0.11,80.0,40.0,false',
  ];
  return [headers, ...examples].join('\n');
}

export function iviveCSVTemplate(): string {
  const headers = 'species,body_weight_kg,liver_weight_g,MPPGL,HPGL,Qh_mL_min';
  const examples = [
    'rat,0.25,10.0,45,117,13.8',
    'dog,11.3,309.0,52,215,309.0',
    'human,70.0,1800.0,45,120,1500.0',
  ];
  return [headers, ...examples].join('\n');
}

export function ddiCSVTemplate(): string {
  const headers = 'enzyme_or_transporter,type,Ki_uM,IC50_uM,kinact_h,KI_uM,Emax_fold,EC50_uM,fm,Iu_max_uM';
  const examples = [
    'CYP3A4,reversible_inhibitor,,5.0,,,,,,0.5',
    'CYP3A4,TDI,,,,1.2,0.8,,,0.5',
    'CYP3A4,substrate,,,,,,,0.65,',
    'CYP2D6,substrate,,,,,,,0.20,',
  ];
  return [headers, ...examples].join('\n');
}
