import { computed, Injectable, signal } from '@angular/core';

import {
  AppState,
  ImportJobResult,
  Order,
  UnmatchedProduct,
  createEmptyAppState
} from '../models';

export interface OrderImportApplyPayload {
  orders: Order[];
  unmatchedProducts: UnmatchedProduct[];
  result: ImportJobResult;
}

@Injectable({ providedIn: 'root' })
export class StoreService {
  readonly #state = signal<AppState>(createEmptyAppState());

  readonly state = this.#state.asReadonly();

  readonly isLoaded = computed(() => this.#state().meta.loadedAt !== null);

  readonly productCount = computed(() => this.#state().products.length);

  readonly orderCount = computed(() => this.#state().orders.length);

  readonly unmatchedCount = computed(() => this.#state().unmatchedProducts.length);

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

  applyOrderImport(payload: OrderImportApplyPayload): void {
    this.#state.update((current) => {
      const mergedUnmatched = this.#mergeUnmatched(
        current.unmatchedProducts,
        payload.unmatchedProducts
      );
      const loadedAt = current.meta.loadedAt ?? new Date().toISOString();

      const nextDirtyReasons = payload.orders.length > 0
        ? this.#appendDirtyReason(current.dirty.reasons, 'import_orders')
        : current.dirty.reasons;

      return {
        ...current,
        meta: {
          ...current.meta,
          loadedAt
        },
        orders: [...current.orders, ...payload.orders],
        unmatchedProducts: mergedUnmatched,
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

  #mergeUnmatched(existing: UnmatchedProduct[], incoming: UnmatchedProduct[]): UnmatchedProduct[] {
    const map = new Map<string, UnmatchedProduct>();

    for (const unmatched of existing) {
      map.set(this.#unmatchedKey(unmatched), unmatched);
    }

    for (const unmatched of incoming) {
      map.set(this.#unmatchedKey(unmatched), unmatched);
    }

    return [...map.values()];
  }

  #unmatchedKey(value: UnmatchedProduct): string {
    return `${value.platform}::${value.orderNo}::${value.orderLineId}`;
  }
}
