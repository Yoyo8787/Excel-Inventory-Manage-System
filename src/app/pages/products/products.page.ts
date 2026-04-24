import { Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';

import { LayoutService, StoreService } from '../../core/services';
import type { PlatformType, Product, UnmatchedProduct } from '../../core/models';

import { AddProductDialog } from './add-product-dialog';
import { MappingDialog, MappingDialogData } from './mapping-dialog';

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
  readonly selectedIdx = signal<number | null>(null);
  readonly confirmDeleteProductId = signal<string | null>(null);

  readonly filtered = computed(() => {
    const products = this.state().products;
    const query = this.q().toLowerCase();
    if (!query) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(query) ||
      (p.sku ?? '').toLowerCase().includes(query)
    );
  });

  readonly active = computed(() => {
    const idx = this.selectedIdx();
    if (idx === null) return null;
    return this.state().products[idx] ?? null;
  });

  readonly activeMappings = computed(() => {
    const product = this.active();
    if (!product) return [];
    return this.state().mappings.filter(m =>
      m.items.some(item => item.productId === product.id)
    );
  });

  readonly unmatchedCount = this.#store.unmatchedCount;

  readonly unmatchedByPlatform = computed(() => {
    const groups = new Map<PlatformType, UnmatchedProduct[]>();
    for (const u of this.#store.unmatchedProducts()) {
      const list = groups.get(u.platform) ?? [];
      list.push(u);
      groups.set(u.platform, list);
    }
    return [...groups.entries()].map(([platform, items]) => ({ platform, items }));
  });

  mappingCount(productId: string): number {
    return this.state().mappings.filter(m =>
      m.items.some(item => item.productId === productId)
    ).length;
  }

  selectProduct(product: Product): void {
    const idx = this.state().products.indexOf(product);
    this.selectedIdx.set(idx >= 0 ? idx : null);
    this.confirmDeleteProductId.set(null);
  }

  openAddProduct(): void {
    this.#dialog.open(AddProductDialog, {
      panelClass: 'ledger-dialog',
    }).afterClosed().subscribe((product: Product | null) => {
      if (!product) return;
      this.#store.addProduct(product);
      this.#layout.showMessage(`已新增商品：${product.name}`);
    });
  }

  openMappingDialog(prefill?: { platform?: PlatformType; platformProductName?: string }): void {
    const data: MappingDialogData = {
      products: this.state().products,
      unmatchedProducts: this.#store.unmatchedProducts(),
      prefillProduct: this.active() ?? undefined,
      prefillPlatform: prefill?.platform,
      prefillPlatformProductName: prefill?.platformProductName,
    };
    this.#dialog.open(MappingDialog, {
      panelClass: 'ledger-dialog',
      data,
    }).afterClosed().subscribe(mapping => {
      if (!mapping) return;
      this.#store.addMapping(mapping);
      this.#layout.showMessage(`已新增配對：${mapping.platformProductName}`);
    });
  }

  requestDeleteProduct(productId: string): void {
    this.confirmDeleteProductId.set(productId);
  }

  cancelDeleteProduct(): void {
    this.confirmDeleteProductId.set(null);
  }

  confirmDeleteProduct(product: Product): void {
    this.#store.deleteProduct(product.id);
    this.confirmDeleteProductId.set(null);
    if (this.active()?.id === product.id) {
      this.selectedIdx.set(null);
    }
    this.#layout.showMessage(`已刪除商品：${product.name}`);
  }

  deleteMapping(mappingId: string, platformProductName: string): void {
    this.#store.deleteMapping(mappingId);
    this.#layout.showMessage(`已移除配對：${platformProductName}`);
  }

  getProduct(productId: string): Product | undefined {
    return this.state().products.find(p => p.id === productId);
  }

  countUnmatched(platform: PlatformType, platformProductName: string): number {
    return this.#store.unmatchedProducts().filter(
      u => u.platform === platform && u.platformProductName === platformProductName
    ).length;
  }
}
