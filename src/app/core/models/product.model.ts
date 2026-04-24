import type { ProductId } from './system.model';

export interface Product {
  id: ProductId;
  name: string;
  lowStockThreshold: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}
