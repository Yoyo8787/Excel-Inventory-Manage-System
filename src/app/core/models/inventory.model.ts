import type { ProductId } from './system.model';

export type InventoryDirection = 'deduct' | 'restock' | 'ignore';

export interface InventoryMovement {
  productId: ProductId;
  direction: InventoryDirection;
  quantity: number;
  source: 'inbound' | 'order';
  sourceId: string;
}

export interface InventorySnapshot {
  productId: ProductId;
  productName: string;
  inboundTotal: number;
  deductedTotal: number;
  restockedTotal: number;
  onHand: number;
  isLowStock: boolean;
}
