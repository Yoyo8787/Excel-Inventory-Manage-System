import type { PlatformType } from './system.model';

export interface ImportErrorRow {
  rowNumber: number;
  platform: PlatformType;
  orderNo?: string;
  field: string;
  reason: string;
  raw: Record<string, unknown>;
}

export interface ImportJobResult {
  importedCount: number;
  duplicateCount: number;
  errorCount: number;
  errors: ImportErrorRow[];
}
