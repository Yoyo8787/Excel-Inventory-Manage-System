import type { ProductId } from './system.model';

export interface Product {
  id: ProductId;
  sku?: string;
  name: string;
  lowStockThreshold: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}
