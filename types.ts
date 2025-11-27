export interface FileEntry {
  id: string;
  originalName: string;
}

export type ScriptMode = 'series' | 'movies';

export interface SimulationResult {
  originalName: string;
  newName: string;
  targetFolder: string;
  season?: number;
  episode?: number;
  year?: string;
  isValid: boolean;
  reason?: string;
}

export interface ScriptConfig {
  showName: string;
  dryRun: boolean;
  conflictAction: 'skip' | 'overwrite' | 'rename';
}
