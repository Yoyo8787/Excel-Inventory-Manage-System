import type { InboundId } from './system.model';

export interface InboundRecord {
  id: InboundId;
  productName: string;
  productStyle: string;
  quantity: number;
  importedAt: string;
}
