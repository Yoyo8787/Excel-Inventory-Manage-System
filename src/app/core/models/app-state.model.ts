import type { ImportJobResult } from './import.model';
import type { InboundRecord } from './inbound.model';
import type { PlatformProductMapping } from './mapping.model';
import type { Order } from './order.model';
import type { Product } from './product.model';
import type { DirtyState, SystemMeta } from './system.model';

export interface AppState {
  meta: SystemMeta;
  dirty: DirtyState;
  products: Product[];
  mappings: PlatformProductMapping[];
  orders: Order[];
  inbounds: InboundRecord[];
  lastImportResult: ImportJobResult | null;
}

export const createEmptyAppState = (datasetName = 'Untitled dataset'): AppState => ({
  meta: {
    datasetName,
    loadedAt: null,
    lastSavedAt: null,
  },
  dirty: {
    isDirty: false,
    reasons: [],
  },
  products: [],
  mappings: [],
  orders: [],
  inbounds: [],
  lastImportResult: null,
});
