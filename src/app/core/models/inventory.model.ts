export type InventoryDirection = 'deduct' | 'restock' | 'ignore';

export interface InventoryMovement {
  productName: string;
  productStyle: string;
  direction: InventoryDirection;
  quantity: number;
  source: 'inbound' | 'outbound';
  sourceId: string;
}

export interface InventorySnapshot {
  key: string;
  productName: string;
  productStyle: string;
  inboundTotal: number;
  deductedTotal: number;
  onHand: number;
  isLowStock: boolean;
}
