import type { MappingItem } from './mapping.model';
import type { Id, OrderId, PlatformType } from './system.model';

export const OrderBusinessStatuses = {
  normal: '尚未出貨',
  shipped: '已出貨',
  cancelled: '已取消',
  returned: '已退貨',
  resend: '重寄',
  exchange_reserved: '換貨待確認',
};

export type OrderBusinessStatus =
  (typeof OrderBusinessStatuses)[keyof typeof OrderBusinessStatuses];

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
  statusRaw: string;
  status: OrderBusinessStatus;
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
