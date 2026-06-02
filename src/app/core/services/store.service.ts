import { computed, Injectable, signal } from '@angular/core';

import {
  AppState,
  InboundRecord,
  ImportJobResult,
  InventorySnapshot,
  MappingId,
  MappingItem,
  OutboundRecord,
  ProductAliasMapping,
  ProductKey,
  UnmatchedOutbound,
  createEmptyAppState,
} from '../models';

export interface InboundImportApplyPayload {
  records: InboundRecord[];
  result: ImportJobResult;
}

export interface OutboundImportApplyPayload {
  records: OutboundRecord[];
  result: ImportJobResult;
}

export interface ImportBatchSummary {
  importedAt: string;
  count: number;
  quantity: number;
}

interface QuantityBucket {
  productName: string;
  productStyle: string;
  quantity: number;
}

@Injectable({ providedIn: 'root' })
export class StoreService {
  readonly #state = signal<AppState>(createEmptyAppState());

  readonly state = this.#state.asReadonly();

  readonly isLoaded = computed(() => this.#state().meta.loadedAt !== null);

  readonly inboundCount = computed(() => this.#state().inbounds.length);

  readonly outboundCount = computed(() => this.#state().outbounds.length);

  readonly inventorySnapshots = computed<InventorySnapshot[]>(() => {
    const state = this.#state();
    const inboundMap = new Map<string, QuantityBucket>();
    const deductedMap = new Map<string, QuantityBucket>();
    const inboundKeys = new Set<string>();

    for (const record of state.inbounds) {
      const key = this.#recordKey(record.productName, record.productStyle);
      inboundKeys.add(key);
      const current = inboundMap.get(key);
      inboundMap.set(key, {
        productName: record.productName,
        productStyle: record.productStyle,
        quantity: (current?.quantity ?? 0) + record.quantity,
      });
    }

    for (const record of state.outbounds) {
      for (const item of this.#resolveOutboundTargets(record, inboundKeys, state.mappings)) {
        const key = this.#recordKey(item.productName, item.productStyle);
        const current = deductedMap.get(key);
        deductedMap.set(key, {
          productName: item.productName,
          productStyle: item.productStyle,
          quantity: (current?.quantity ?? 0) + record.quantity * item.quantity,
        });
      }
    }

    const keys = new Set([...inboundMap.keys(), ...deductedMap.keys()]);

    return [...keys]
      .map((key) => {
        const inbound = inboundMap.get(key);
        const deducted = deductedMap.get(key);
        const productName = inbound?.productName ?? deducted?.productName ?? '';
        const productStyle = inbound?.productStyle ?? deducted?.productStyle ?? '';
        const inboundTotal = inbound?.quantity ?? 0;
        const deductedTotal = deducted?.quantity ?? 0;
        const onHand = inboundTotal - deductedTotal;

        return {
          key,
          productName,
          productStyle,
          inboundTotal,
          deductedTotal,
          onHand,
          isLowStock: onHand <= state.settings.defaultLowStockThreshold,
        };
      })
      .sort((a, b) =>
        a.productName.localeCompare(b.productName, 'zh-Hant') ||
        a.productStyle.localeCompare(b.productStyle, 'zh-Hant')
      );
  });

  readonly standardProductKeys = computed<ProductKey[]>(() => {
    const seen = new Set<string>();
    const keys: ProductKey[] = [];

    for (const record of this.#state().inbounds) {
      const key = this.#recordKey(record.productName, record.productStyle);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      keys.push({
        productName: record.productName,
        productStyle: record.productStyle,
      });
    }

    return keys.sort((a, b) =>
      a.productName.localeCompare(b.productName, 'zh-Hant') ||
      a.productStyle.localeCompare(b.productStyle, 'zh-Hant')
    );
  });

  readonly lowStockProducts = computed(() =>
    this.inventorySnapshots().filter((snapshot) => snapshot.isLowStock),
  );

  readonly unmatchedOutbounds = computed<UnmatchedOutbound[]>(() => {
    const state = this.#state();
    const inboundKeys = new Set(
      state.inbounds.map((record) => this.#recordKey(record.productName, record.productStyle)),
    );

    return state.outbounds
      .filter((record) => this.#resolveOutboundTargets(record, inboundKeys, state.mappings).length === 0)
      .map((record) => ({
        outboundId: record.id,
        productName: record.productName,
        productStyle: record.productStyle,
        quantity: record.quantity,
        recipientName: record.recipientName,
        importedAt: record.importedAt,
      }));
  });

  readonly unmatchedCount = computed(() => this.unmatchedOutbounds().length);

  readonly inboundBatches = computed(() => this.#batchSummaries(this.#state().inbounds));

  readonly outboundBatches = computed(() => this.#batchSummaries(this.#state().outbounds));

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
      ...base,
      ...state,
      settings: {
        ...base.settings,
        ...(state.settings ?? {}),
      },
      meta: {
        ...base.meta,
        ...state.meta,
        datasetName: datasetName ?? state.meta.datasetName,
        loadedAt: now,
      },
      dirty: {
        isDirty: false,
        reasons: [],
      },
      lastImportResult: null,
    });
  }

  replaceState(state: AppState): void {
    this.#state.set(state);
  }

  markDirty(reason: string): void {
    this.#state.update((current) => ({
      ...current,
      dirty: {
        isDirty: true,
        reasons: this.#appendDirtyReason(current.dirty.reasons, reason),
      },
    }));
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

  addMapping(mapping: ProductAliasMapping): void {
    const sourceKey = this.#recordKey(mapping.sourceProductName, mapping.sourceProductStyle);

    this.#state.update((s) => ({
      ...s,
      mappings: [
        ...s.mappings.filter(
          (item) => this.#recordKey(item.sourceProductName, item.sourceProductStyle) !== sourceKey,
        ),
        mapping,
      ],
      dirty: { isDirty: true, reasons: this.#appendDirtyReason(s.dirty.reasons, 'mapping_upsert') },
    }));
  }

  deleteMapping(mappingId: MappingId): void {
    this.#state.update((s) => ({
      ...s,
      mappings: s.mappings.filter((m) => m.id !== mappingId),
      dirty: { isDirty: true, reasons: this.#appendDirtyReason(s.dirty.reasons, 'mapping_delete') },
    }));
  }

  applyInboundImport(payload: InboundImportApplyPayload): void {
    this.#state.update((current) => {
      const loadedAt = current.meta.loadedAt ?? new Date().toISOString();
      const hasRecords = payload.records.length > 0;

      return {
        ...current,
        meta: { ...current.meta, loadedAt },
        inbounds: [...current.inbounds, ...payload.records],
        lastImportResult: payload.result,
        dirty: {
          isDirty: current.dirty.isDirty || hasRecords,
          reasons: hasRecords
            ? this.#appendDirtyReason(current.dirty.reasons, 'import_inbounds')
            : current.dirty.reasons,
        },
      };
    });
  }

  applyOutboundImport(payload: OutboundImportApplyPayload): void {
    this.#state.update((current) => {
      const loadedAt = current.meta.loadedAt ?? new Date().toISOString();
      const hasRecords = payload.records.length > 0;

      return {
        ...current,
        meta: { ...current.meta, loadedAt },
        outbounds: [...current.outbounds, ...payload.records],
        lastImportResult: payload.result,
        dirty: {
          isDirty: current.dirty.isDirty || hasRecords,
          reasons: hasRecords
            ? this.#appendDirtyReason(current.dirty.reasons, 'import_outbounds')
            : current.dirty.reasons,
        },
      };
    });
  }

  removeInboundBatch(importedAt: string): void {
    this.#state.update((s) => ({
      ...s,
      inbounds: s.inbounds.filter((record) => record.importedAt !== importedAt),
      dirty: {
        isDirty: true,
        reasons: this.#appendDirtyReason(s.dirty.reasons, 'inbound_batch_remove'),
      },
    }));
  }

  removeOutboundBatch(importedAt: string): void {
    this.#state.update((s) => ({
      ...s,
      outbounds: s.outbounds.filter((record) => record.importedAt !== importedAt),
      dirty: {
        isDirty: true,
        reasons: this.#appendDirtyReason(s.dirty.reasons, 'outbound_batch_remove'),
      },
    }));
  }

  #batchSummaries(records: Array<{ importedAt: string; quantity: number }>): ImportBatchSummary[] {
    const map = new Map<string, ImportBatchSummary>();

    for (const record of records) {
      const current = map.get(record.importedAt) ?? {
        importedAt: record.importedAt,
        count: 0,
        quantity: 0,
      };
      current.count += 1;
      current.quantity += record.quantity;
      map.set(record.importedAt, current);
    }

    return [...map.values()].sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  }

  #resolveOutboundTargets(
    record: OutboundRecord,
    inboundKeys: Set<string>,
    mappings: ProductAliasMapping[],
  ): MappingItem[] {
    const sourceKey = this.#recordKey(record.productName, record.productStyle);
    const mapping = mappings.find(
      (item) => this.#recordKey(item.sourceProductName, item.sourceProductStyle) === sourceKey,
    );

    if (mapping && mapping.items.length > 0) {
      return mapping.items.map((item) => ({ ...item }));
    }

    if (record.productStyle.trim().length === 0) {
      return [];
    }

    if (inboundKeys.has(sourceKey)) {
      return [
        {
          productName: record.productName,
          productStyle: record.productStyle,
          quantity: 1,
        },
      ];
    }

    return [];
  }

  #appendDirtyReason(reasons: string[], reason: string): string[] {
    if (reasons.includes(reason)) {
      return reasons;
    }

    return [...reasons, reason];
  }

  #recordKey(productName: string, productStyle: string): string {
    return `${productName.trim()}\u0000${productStyle.trim()}`;
  }
}
