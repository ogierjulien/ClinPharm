import { v4 as uuidv4 } from 'uuid';
import type {
  ModuleType,
  RunMetadata,
  AllometrySessionResult,
  IVIVESessionResult,
  DDISessionResult,
  UploadedSession,
  Warning,
} from '@/types';

export const APP_VERSION = '1.0.0';
export const FORMULA_SET_VERSION = '1.0.0';
export const PHYSIOLOGY_VERSION = '1.0.0';

export function createRunMetadata(appType: ModuleType): RunMetadata {
  return {
    runId: uuidv4(),
    timestamp: new Date().toISOString(),
    appType,
    appVersion: APP_VERSION,
    formulaSetVersion: FORMULA_SET_VERSION,
    physiologyVersion: PHYSIOLOGY_VERSION,
  };
}

export function serializeSession(
  result: AllometrySessionResult | IVIVESessionResult | DDISessionResult
): string {
  return JSON.stringify(result, null, 2);
}

export function deserializeSession(json: string): AllometrySessionResult | IVIVESessionResult | DDISessionResult {
  const parsed = JSON.parse(json);
  if (!parsed.metadata?.appType) {
    throw new Error('Invalid session file: missing metadata.appType');
  }
  return parsed;
}

export function detectModuleType(parsed: unknown): ModuleType {
  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('Invalid session file format');
  }
  const obj = parsed as Record<string, unknown>;
  const appType = (obj.metadata as Record<string, unknown>)?.appType as string;
  if (['allometry', 'ivive', 'ddi', 'reporting'].includes(appType)) {
    return appType as ModuleType;
  }
  throw new Error(`Unknown module type: ${appType}`);
}

export async function parseUploadedFile(file: File): Promise<UploadedSession> {
  const text = await file.text();
  let parsed: unknown;

  if (file.name.endsWith('.json')) {
    parsed = JSON.parse(text);
  } else {
    throw new Error('Only JSON session files are supported for re-upload');
  }

  const moduleType = detectModuleType(parsed);

  return {
    moduleType,
    result: parsed as AllometrySessionResult | IVIVESessionResult | DDISessionResult,
    filename: file.name,
    uploadedAt: new Date().toISOString(),
  };
}

// Generate a unique run label for display
export function runLabel(metadata: RunMetadata): string {
  const d = new Date(metadata.timestamp);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  return `${metadata.appType.toUpperCase()} — ${date} ${time}`;
}

// Aggregate warnings and deduplicate
export function deduplicateWarnings(warnings: Warning[]): Warning[] {
  const seen = new Set<string>();
  return warnings.filter(w => {
    const key = `${w.code}:${w.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
