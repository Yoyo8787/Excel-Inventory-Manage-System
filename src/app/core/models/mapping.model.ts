import type { MappingId, PlatformType, ProductId } from './system.model';

export interface MappingItem {
  productId: ProductId;
  quantity: number;
}

export interface PlatformProductMapping {
  id: MappingId;
  platform: PlatformType;
  platformProductName: string;
  items: MappingItem[];
  updatedAt: string;
}
