import type { ImportErrorRow, InboundRecord } from '../../core/models';

export interface InboundLine {
  productName: string;
  productStyle: string;
  qty: number;
}

export interface InboundImportSummary {
  importedCount: number;
  errorCount: number;
  errors: ImportErrorRow[];
}

export interface InboundBatchSection {
  importedAt: string;
  count: number;
  quantity: number;
  records: InboundRecord[];
}

export type InboundLineKey = 'productName' | 'productStyle' | 'qty';
