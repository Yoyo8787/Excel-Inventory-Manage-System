export type Id = string;
export type MappingId = Id;
export type InboundId = Id;
export type OutboundId = Id;

export interface SystemMeta {
  datasetName: string;
  loadedAt: string | null;
  lastSavedAt: string | null;
}

export interface AppSettings {
  defaultLowStockThreshold: number;
}

export interface DirtyState {
  isDirty: boolean;
  reasons: string[];
}
