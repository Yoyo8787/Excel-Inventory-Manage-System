import type { ImportJobResult } from './import.model';
import type { InboundRecord } from './inbound.model';
import type { ProductAliasMapping } from './mapping.model';
import type { OutboundRecord } from './order.model';
import type { AppSettings, DirtyState, SystemMeta } from './system.model';

export interface AppState {
  meta: SystemMeta;
  settings: AppSettings;
  dirty: DirtyState;
  mappings: ProductAliasMapping[];
  inbounds: InboundRecord[];
  outbounds: OutboundRecord[];
  lastImportResult: ImportJobResult | null;
}

export const createEmptyAppState = (datasetName = 'Untitled dataset'): AppState => ({
  meta: {
    datasetName,
    loadedAt: null,
    lastSavedAt: null,
  },
  settings: {
    defaultLowStockThreshold: 20,
  },
  dirty: {
    isDirty: false,
    reasons: [],
  },
  mappings: [],
  inbounds: [],
  outbounds: [],
  lastImportResult: null,
});
