import { Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { LayoutService, StoreService } from '../../core/services';
import type { InventorySnapshot, ProductKey, UnmatchedOutbound } from '../../core/models';

import { MappingDialog, MappingDialogData } from './mapping-dialog';

interface UnmatchedGroup {
  key: string;
  productName: string;
  productStyle: string;
  count: number;
  quantity: number;
  latestImportedAt: string;
}

@Component({
  selector: 'page-products',
  imports: [],
  templateUrl: './products.page.html',
})
export class ProductsPage {
  readonly #store = inject(StoreService);
  readonly #dialog = inject(MatDialog);
  readonly #layout = inject(LayoutService);

  readonly state = this.#store.state;

  readonly q = signal('');
  readonly selectedKey = signal<string | null>(null);

  readonly snapshots = this.#store.inventorySnapshots;
  readonly mappings = computed(() => this.state().mappings);
  readonly unmatched = this.#store.unmatchedOutbounds;
  readonly unmatchedCount = this.#store.unmatchedCount;

  readonly filtered = computed(() => {
    const query = this.q().trim().toLowerCase();
    const snapshots = this.snapshots();
    if (!query) return snapshots;
    return snapshots.filter((item) =>
      item.productName.toLowerCase().includes(query) ||
      item.productStyle.toLowerCase().includes(query)
    );
  });

  readonly active = computed(() => {
    const key = this.selectedKey();
    if (!key) return null;
    return this.snapshots().find((item) => item.key === key) ?? null;
  });

  readonly activeMappings = computed(() => {
    const active = this.active();
    if (!active) return [];

    return this.mappings().filter((mapping) =>
      mapping.items.some(
        (item) =>
          item.productName === active.productName &&
          item.productStyle === active.productStyle,
      )
    );
  });

  readonly unmatchedGroups = computed<UnmatchedGroup[]>(() => {
    const map = new Map<string, UnmatchedGroup>();

    for (const item of this.unmatched()) {
      const key = this.#recordKey(item.productName, item.productStyle);
      const current = map.get(key) ?? {
        key,
        productName: item.productName,
        productStyle: item.productStyle,
        count: 0,
        quantity: 0,
        latestImportedAt: item.importedAt,
      };
      current.count += 1;
      current.quantity += item.quantity;
      current.latestImportedAt =
        item.importedAt > current.latestImportedAt ? item.importedAt : current.latestImportedAt;
      map.set(key, current);
    }

    return [...map.values()].sort((a, b) => b.latestImportedAt.localeCompare(a.latestImportedAt));
  });

  selectSnapshot(snapshot: InventorySnapshot): void {
    this.selectedKey.set(snapshot.key);
  }

  openMappingDialog(prefill?: ProductKey): void {
    const data: MappingDialogData = {
      inventoryItems: this.#store.standardProductKeys(),
      unmatchedOutbounds: this.unmatched(),
      prefillSource: prefill,
    };

    this.#dialog.open(MappingDialog, {
      panelClass: 'ledger-dialog',
      data,
    }).afterClosed().subscribe(mapping => {
      if (!mapping) return;
      this.#store.addMapping(mapping);
      this.#layout.showMessage(`已新增配對：${mapping.sourceProductName} / ${mapping.sourceProductStyle || '空白'}`);
    });
  }

  deleteMapping(mappingId: string, sourceProductName: string, sourceProductStyle: string): void {
    this.#store.deleteMapping(mappingId);
    this.#layout.showMessage(`已移除配對：${sourceProductName} / ${sourceProductStyle || '空白'}`);
  }

  countUnmatched(group: UnmatchedGroup): number {
    return this.unmatched().filter(
      item => item.productName === group.productName && item.productStyle === group.productStyle
    ).length;
  }

  formatStyle(style: string): string {
    return style || '空白';
  }

  #recordKey(productName: string, productStyle: string): string {
    return `${productName.trim()}\u0000${productStyle.trim()}`;
  }
}
