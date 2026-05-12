import { create } from 'zustand';
import {
  ModuleType,
  AllometryInputs,
  AllometryResults,
  IVIVEInputs,
  IVIVEResults,
  DDIInputs,
  DDIResults,
  UploadedSession,
  Warning,
} from '@/types';
import type {
  AllometrySessionResult,
  IVIVESessionResult,
  DDISessionResult,
} from '@/types';

interface AppState {
  // Active module
  activeModule: ModuleType | 'dashboard';
  setActiveModule: (m: ModuleType | 'dashboard') => void;

  // Allometry state
  allometryInputs: AllometryInputs | null;
  allometryResults: AllometryResults | null;
  allometryRunning: boolean;
  setAllometryInputs: (inputs: AllometryInputs) => void;
  setAllometryResults: (results: AllometryResults | null) => void;
  setAllometryRunning: (v: boolean) => void;

  // IVIVE state
  iviveInputs: IVIVEInputs | null;
  iviveResults: IVIVEResults | null;
  iviveRunning: boolean;
  setIVIVEInputs: (inputs: IVIVEInputs) => void;
  setIVIVEResults: (results: IVIVEResults | null) => void;
  setIVIVERunning: (v: boolean) => void;

  // DDI state
  ddiInputs: DDIInputs | null;
  ddiResults: DDIResults | null;
  ddiRunning: boolean;
  setDDIInputs: (inputs: DDIInputs) => void;
  setDDIResults: (results: DDIResults | null) => void;
  setDDIRunning: (v: boolean) => void;

  // Uploaded sessions
  uploadedSessions: UploadedSession[];
  addUploadedSession: (s: UploadedSession) => void;
  removeUploadedSession: (index: number) => void;
  clearUploadedSessions: () => void;

  // Saved runs history
  savedRuns: Array<AllometrySessionResult | IVIVESessionResult | DDISessionResult>;
  saveRun: (run: AllometrySessionResult | IVIVESessionResult | DDISessionResult) => void;
  clearSavedRuns: () => void;

  // Global warnings
  globalWarnings: Warning[];
  addGlobalWarning: (w: Warning) => void;
  clearGlobalWarnings: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Active module
  activeModule: 'dashboard',
  setActiveModule: (m) => set({ activeModule: m }),

  // Allometry state
  allometryInputs: null,
  allometryResults: null,
  allometryRunning: false,
  setAllometryInputs: (inputs) => set({ allometryInputs: inputs }),
  setAllometryResults: (results) => set({ allometryResults: results }),
  setAllometryRunning: (v) => set({ allometryRunning: v }),

  // IVIVE state
  iviveInputs: null,
  iviveResults: null,
  iviveRunning: false,
  setIVIVEInputs: (inputs) => set({ iviveInputs: inputs }),
  setIVIVEResults: (results) => set({ iviveResults: results }),
  setIVIVERunning: (v) => set({ iviveRunning: v }),

  // DDI state
  ddiInputs: null,
  ddiResults: null,
  ddiRunning: false,
  setDDIInputs: (inputs) => set({ ddiInputs: inputs }),
  setDDIResults: (results) => set({ ddiResults: results }),
  setDDIRunning: (v) => set({ ddiRunning: v }),

  // Uploaded sessions
  uploadedSessions: [],
  addUploadedSession: (s) =>
    set((state) => ({ uploadedSessions: [...state.uploadedSessions, s] })),
  removeUploadedSession: (index) =>
    set((state) => ({
      uploadedSessions: state.uploadedSessions.filter((_, i) => i !== index),
    })),
  clearUploadedSessions: () => set({ uploadedSessions: [] }),

  // Saved runs history
  savedRuns: [],
  saveRun: (run) =>
    set((state) => ({ savedRuns: [...state.savedRuns, run] })),
  clearSavedRuns: () => set({ savedRuns: [] }),

  // Global warnings
  globalWarnings: [],
  addGlobalWarning: (w) =>
    set((state) => ({ globalWarnings: [...state.globalWarnings, w] })),
  clearGlobalWarnings: () => set({ globalWarnings: [] }),
}));
