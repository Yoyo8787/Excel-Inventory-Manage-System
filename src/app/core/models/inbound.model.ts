import type { InboundId, ProductId } from './system.model';

export interface InboundRecord {
  id: InboundId;
  productId: ProductId;
  quantity: number;
  inboundDate: string;
  note?: string;
  createdAt: string;
}
