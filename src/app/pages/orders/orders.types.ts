import type { ImportErrorRow, OutboundRecord } from '../../core/models';

export interface OutboundImportSummary {
  importedCount: number;
  errorCount: number;
  errors: ImportErrorRow[];
}

export interface OutboundBatchSection {
  importedAt: string;
  count: number;
  quantity: number;
  records: OutboundRecord[];
}
