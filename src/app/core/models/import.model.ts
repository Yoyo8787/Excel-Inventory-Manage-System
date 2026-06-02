export type ImportRecordType = 'inbound' | 'outbound';

export interface ImportErrorRow {
  rowNumber: number;
  type: ImportRecordType;
  field: string;
  reason: string;
  raw: Record<string, unknown>;
}

export interface ImportJobResult {
  type: ImportRecordType;
  importedCount: number;
  errorCount: number;
  errors: ImportErrorRow[];
}
