import { computed, Injectable, signal } from '@angular/core';

import {
  AppState,
  InboundRecord,
  ImportJobResult,
  InventorySnapshot,
  MappingItem,
  MappingId,
  Order,
  PlatformProductMapping,
  Product,
  ProductId,
  UnmatchedProduct,
  PlatFormTypes,
  createEmptyAppState,
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
    const seen = new Set<string>();
    const result: UnmatchedProduct[] = [];

    for (const order of orders) {
      for (const line of order.lines) {
        const key = `${order.platform}::${line.platformProductName}`;
        const mappedItems = this.#resolveMappedItems(
          order,
          line.platformProductName,
          line.mappedItems,
          mappings,
        );

        if (mappedItems.length === 0 && !seen.has(key)) {
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

  readonly inventorySnapshots = computed<InventorySnapshot[]>(() => {
    const { products, inbounds, orders, mappings } = this.#state();
    const inboundMap = new Map<ProductId, number>();
    const deductedMap = new Map<ProductId, number>();

    for (const record of inbounds) {
      const current = inboundMap.get(record.productId) ?? 0;
      inboundMap.set(record.productId, current + record.quantity);
    }

    for (const order of orders) {
      for (const line of order.lines) {
        const mappedItems = this.#resolveMappedItems(
          order,
          line.platformProductName,
          line.mappedItems,
          mappings,
        );

        for (const item of mappedItems) {
          const current = deductedMap.get(item.productId) ?? 0;
          deductedMap.set(item.productId, current + line.quantity * item.quantity);
        }
      }
    }

    return products
      .map((p) => ({
        productId: p.id,
        productName: p.name,
        inboundTotal: inboundMap.get(p.id) ?? 0,
        deductedTotal: deductedMap.get(p.id) ?? 0,
        restockedTotal: 0,
        onHand: (inboundMap.get(p.id) ?? 0) - (deductedMap.get(p.id) ?? 0),
        isLowStock:
          (inboundMap.get(p.id) ?? 0) - (deductedMap.get(p.id) ?? 0) <= p.lowStockThreshold,
      }))
      .sort((a, b) => a.productName.localeCompare(b.productName, 'zh-Hant'));
  });

  readonly lowStockProducts = computed(() => {
    const productMap = new Map(this.#state().products.map((p) => [p.id, p]));

    return this.inventorySnapshots()
      .filter((snapshot) => snapshot.isLowStock)
      .map((snapshot) => ({
        ...productMap.get(snapshot.productId)!,
        stockQty: snapshot.onHand,
      }));
  });

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
        loadedAt: now,
      },
      dirty: {
        isDirty: true,
        reasons: ['create_dataset'],
      },
    });
  }

  loadDataset(state: AppState, datasetName?: string): void {
    const now = new Date().toISOString();
    const base = createEmptyAppState();

    this.#state.set({
      ...state,
      settings: {
        ...base.settings,
        ...(state.settings ?? {}),
      },
      meta: {
        ...state.meta,
        datasetName: datasetName ?? state.meta.datasetName,
        loadedAt: now,
      },
      dirty: {
        isDirty: false,
        reasons: [],
      },
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
            isDirty: true,
          },
        };
      }

      return {
        ...current,
        dirty: {
          isDirty: true,
          reasons: [...current.dirty.reasons, reason],
        },
      };
    });
  }

  clearDirty(): void {
    this.#state.update((current) => ({
      ...current,
      dirty: {
        isDirty: false,
        reasons: [],
      },
    }));
  }

  markSaved(): void {
    const now = new Date().toISOString();

    this.#state.update((current) => ({
      ...current,
      meta: {
        ...current.meta,
        lastSavedAt: now,
      },
      dirty: {
        isDirty: false,
        reasons: [],
      },
    }));
  }

  setLastImportResult(result: ImportJobResult | null): void {
    this.#state.update((current) => ({
      ...current,
      lastImportResult: result,
    }));
  }

  addProduct(product: Product): void {
    this.#state.update((s) => ({
      ...s,
      products: [...s.products, product],
      dirty: { isDirty: true, reasons: this.#appendDirtyReason(s.dirty.reasons, 'product_add') },
    }));
  }

  updateDefaultLowStockThreshold(value: number): void {
    const threshold = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

    this.#state.update((s) => ({
      ...s,
      settings: {
        ...s.settings,
        defaultLowStockThreshold: threshold,
      },
      dirty: {
        isDirty: true,
        reasons: this.#appendDirtyReason(s.dirty.reasons, 'settings_update'),
      },
    }));
  }

  deleteProduct(productId: ProductId): void {
    this.#state.update((s) => ({
      ...s,
      products: s.products.filter((p) => p.id !== productId),
      mappings: s.mappings
        .map((m) => ({ ...m, items: m.items.filter((i) => i.productId !== productId) }))
        .filter((m) => m.items.length > 0),
      dirty: { isDirty: true, reasons: this.#appendDirtyReason(s.dirty.reasons, 'product_delete') },
    }));
  }

  addMapping(mapping: PlatformProductMapping): void {
    this.#state.update((s) => ({
      ...s,
      mappings: [...s.mappings, mapping],
      dirty: { isDirty: true, reasons: this.#appendDirtyReason(s.dirty.reasons, 'mapping_add') },
    }));
  }

  deleteMapping(mappingId: MappingId): void {
    this.#state.update((s) => ({
      ...s,
      mappings: s.mappings.filter((m) => m.id !== mappingId),
      dirty: { isDirty: true, reasons: this.#appendDirtyReason(s.dirty.reasons, 'mapping_delete') },
    }));
  }

  deleteOrder(orderId: string): void {
    this.#state.update((s) => ({
      ...s,
      orders: s.orders.filter((order) => order.id !== orderId),
      dirty: {
        isDirty: true,
        reasons: this.#appendDirtyReason(s.dirty.reasons, 'order_delete'),
      },
    }));
  }

  applyOrderImport(payload: OrderImportApplyPayload): void {
    this.#state.update((current) => {
      const loadedAt = current.meta.loadedAt ?? new Date().toISOString();
      const nextDirtyReasons =
        payload.orders.length > 0
          ? this.#appendDirtyReason(current.dirty.reasons, 'import_orders')
          : current.dirty.reasons;

      return {
        ...current,
        meta: { ...current.meta, loadedAt },
        orders: [...current.orders, ...payload.orders],
        lastImportResult: payload.result,
        dirty: {
          isDirty: current.dirty.isDirty || payload.orders.length > 0,
          reasons: nextDirtyReasons,
        },
      };
    });
  }

  applyInbound(records: InboundRecord[]): void {
    this.#state.update((current) => {
      const loadedAt = current.meta.loadedAt ?? new Date().toISOString();
      const nextDirtyReasons =
        records.length > 0
          ? this.#appendDirtyReason(current.dirty.reasons, 'inbound_add')
          : current.dirty.reasons;

      return {
        ...current,
        meta: { ...current.meta, loadedAt },
        inbounds: [...current.inbounds, ...records],
        dirty: {
          isDirty: current.dirty.isDirty || records.length > 0,
          reasons: nextDirtyReasons,
        },
      };
    });
  }

  #appendDirtyReason(reasons: string[], reason: string): string[] {
    if (reasons.includes(reason)) {
      return reasons;
    }

    return [...reasons, reason];
  }

  #resolveMappedItems(
    order: Order,
    platformProductName: string,
    storedItems: MappingItem[],
    mappings: PlatformProductMapping[],
  ): MappingItem[] {
    if (order.platform === PlatFormTypes.Manual) {
      return storedItems.map((item) => ({ ...item }));
    }

    const normalizedName = platformProductName.trim().toLowerCase();
    const mapping = mappings.find(
      (item) =>
        item.platform === order.platform &&
        item.platformProductName.trim().toLowerCase() === normalizedName,
    );

    return mapping?.items.map((item) => ({ ...item })) ?? [];
  }
}
