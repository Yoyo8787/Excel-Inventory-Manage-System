export type Id = string;
export type ProductId = Id;
export type OrderId = Id;
export type MappingId = Id;
export type InboundId = Id;

export const PlatFormTypes = {
  A: '好蒔光',
  B: '仙姑',
  C: '綠崎',
} as const;

export type PlatformType = (typeof PlatFormTypes)[keyof typeof PlatFormTypes];
export type DuplicateOrderPolicy = 'skip';

export interface SystemMeta {
  datasetName: string;
  loadedAt: string | null;
  lastSavedAt: string | null;
}

export interface DirtyState {
  isDirty: boolean;
  reasons: string[];
}
