import type { OutboundId } from './system.model';

export interface OutboundRecord {
  id: OutboundId;
  productName: string;
  productStyle: string;
  quantity: number;
  recipientName: string;
  importedAt: string;
}

export interface UnmatchedOutbound {
  outboundId: OutboundId;
  productName: string;
  productStyle: string;
  quantity: number;
  recipientName: string;
  importedAt: string;
}
