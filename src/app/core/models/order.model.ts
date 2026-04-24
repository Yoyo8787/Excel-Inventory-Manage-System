import type { MappingItem } from './mapping.model';
import type { Id, OrderId, PlatformType } from './system.model';

export interface OrderLine {
  lineId: Id;
  platformProductName: string;
  unitPrice?: number;
  quantity: number;
  subtotal?: number;
  mappedItems: MappingItem[];
  isMatched: boolean;
}

export interface Order {
  id: OrderId;
  platform: PlatformType;
  orderNo: string;
  orderDate: string;
  customerName?: string;
  customerPhone?: string;
  amountTotal?: number;
  address?: string;
  note?: string;
  lines: OrderLine[];
  importedAt: string;
}

export interface UnmatchedProduct {
  platform: PlatformType;
  platformProductName: string;
  orderNo: string;
  orderLineId: Id;
  quantity: number;
  detectedAt: string;
}
