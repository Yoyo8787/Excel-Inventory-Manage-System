import type { MappingId } from './system.model';

export interface MappingItem {
  productName: string;
  productStyle: string;
  quantity: number;
}

export interface ProductAliasMapping {
  id: MappingId;
  sourceProductName: string;
  sourceProductStyle: string;
  items: MappingItem[];
  updatedAt: string;
}
