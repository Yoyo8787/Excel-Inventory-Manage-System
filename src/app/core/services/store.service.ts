import { computed, Injectable, signal } from '@angular/core';

import {
  AppState,
  ImportJobResult,
  MappingId,
  Order,
  PlatformProductMapping,
  Product,
  ProductId,
  UnmatchedProduct,
  createEmptyAppState
} from '../models';

export interface OrderImportApplyPayload {
  orders: Order[];
  result: ImportJobResult;
}

@Injectable({ providedIn: 'root' })
export class StoreService {
  readonly #state = signal<AppState>(createEmptyAppState());

  readonly state = this.#state.asReadonly();

  readonly isLoaded = computed(() => this.#state().meta.loadedAt !== null);

  readonly productCount = computed(() => this.#state().products.length);

  readonly orderCount = computed(() => this.#state().orders.length);

  readonly unmatchedProducts = computed<UnmatchedProduct[]>(() => {
    const { orders, mappings } = this.#state();
    const mappingSet = new Set(mappings.map(m => `${m.platform}::${m.platformProductName}`));
    const seen = new Set<string>();
    const result: UnmatchedProduct[] = [];

    for (const order of orders) {
      for (const line of order.lines) {
        const key = `${order.platform}::${line.platformProductName}`;
        if (!mappingSet.has(key) && !seen.has(key)) {
          seen.add(key);
          result.push({
            platform: order.platform,
            platformProductName: line.platformProductName,
            orderNo: order.orderNo,
            orderLineId: line.lineId,
            quantity: line.quantity,
            detectedAt: order.importedAt,
          });
        }
      }
    }

    return result;
  });

  readonly unmatchedCount = computed(() => this.unmatchedProducts().length);

  get snapshot(): AppState {
    return this.#state();
  }

  createNewDataset(datasetName = 'Untitled dataset'): void {
    const now = new Date().toISOString();
    const next = createEmptyAppState(datasetName);

    this.#state.set({
      ...next,
      meta: {
        ...next.meta,
        loadedAt: now
      },
      dirty: {
        isDirty: true,
        reasons: ['create_dataset']
      }
    });
  }

  loadDataset(state: AppState, datasetName?: string): void {
    const now = new Date().toISOString();

    this.#state.set({
      ...state,
      meta: {
        ...state.meta,
        datasetName: datasetName ?? state.meta.datasetName,
        loadedAt: now
      },
      dirty: {
        isDirty: false,
        reasons: []
      }
    });
  }

  replaceState(state: AppState): void {
    this.#state.set(state);
  }

  markDirty(reason: string): void {
    this.#state.update((current) => {
      if (current.dirty.reasons.includes(reason)) {
        return {
          ...current,
          dirty: {
            ...current.dirty,
            isDirty: true
          }
        };
      }

      return {
        ...current,
        dirty: {
          isDirty: true,
          reasons: [...current.dirty.reasons, reason]
        }
      };
    });
  }

  clearDirty(): void {
    this.#state.update((current) => ({
      ...current,
      dirty: {
        isDirty: false,
        reasons: []
      }
    }));
  }

  markSaved(): void {
    const now = new Date().toISOString();

    this.#state.update((current) => ({
      ...current,
      meta: {
        ...current.meta,
        lastSavedAt: now
      },
      dirty: {
        isDirty: false,
        reasons: []
      }
    }));
  }

  setLastImportResult(result: ImportJobResult | null): void {
    this.#state.update((current) => ({
      ...current,
      lastImportResult: result
    }));
  }

  addProduct(product: Product): void {
    this.#state.update(s => ({
      ...s,
      products: [...s.products, product],
      dirty: { isDirty: true, reasons: this.#appendDirtyReason(s.dirty.reasons, 'product_add') }
    }));
  }

  deleteProduct(productId: ProductId): void {
    this.#state.update(s => ({
      ...s,
      products: s.products.filter(p => p.id !== productId),
      mappings: s.mappings
        .map(m => ({ ...m, items: m.items.filter(i => i.productId !== productId) }))
        .filter(m => m.items.length > 0),
      dirty: { isDirty: true, reasons: this.#appendDirtyReason(s.dirty.reasons, 'product_delete') }
    }));
  }

  addMapping(mapping: PlatformProductMapping): void {
    this.#state.update(s => ({
      ...s,
      mappings: [...s.mappings, mapping],
      dirty: { isDirty: true, reasons: this.#appendDirtyReason(s.dirty.reasons, 'mapping_add') }
    }));
  }

  deleteMapping(mappingId: MappingId): void {
    this.#state.update(s => ({
      ...s,
      mappings: s.mappings.filter(m => m.id !== mappingId),
      dirty: { isDirty: true, reasons: this.#appendDirtyReason(s.dirty.reasons, 'mapping_delete') }
    }));
  }

  applyOrderImport(payload: OrderImportApplyPayload): void {
    this.#state.update((current) => {
      const loadedAt = current.meta.loadedAt ?? new Date().toISOString();
      const nextDirtyReasons = payload.orders.length > 0
        ? this.#appendDirtyReason(current.dirty.reasons, 'import_orders')
        : current.dirty.reasons;

      return {
        ...current,
        meta: { ...current.meta, loadedAt },
        orders: [...current.orders, ...payload.orders],
        lastImportResult: payload.result,
        dirty: {
          isDirty: current.dirty.isDirty || payload.orders.length > 0,
          reasons: nextDirtyReasons
        }
      };
    });
  }

  #appendDirtyReason(reasons: string[], reason: string): string[] {
    if (reasons.includes(reason)) {
      return reasons;
    }

    return [...reasons, reason];
  }
}
