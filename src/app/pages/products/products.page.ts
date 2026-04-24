import { Component, computed, inject, signal } from '@angular/core';

import { StoreService } from '../../core/services/store.service';

@Component({
  selector: 'page-products',
  imports: [],
  templateUrl: './products.page.html',
})
export class ProductsPage {
  readonly #store = inject(StoreService);
  readonly state = this.#store.state;

  readonly q = signal('');
  readonly selectedIdx = signal(0);

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
    const products = this.state().products;
    return products[this.selectedIdx()] ?? null;
  });

  /** 取得選定商品對應的平台配對規則 */
  readonly activeMappings = computed(() => {
    const product = this.active();
    if (!product) return [];
    return this.state().mappings.filter(m =>
      m.items.some(item => item.productId === product.id)
    );
  });

  mappingCount(productId: string): number {
    return this.state().mappings.filter(m =>
      m.items.some(item => item.productId === productId)
    ).length;
  }

  selectProduct(idx: number): void {
    this.selectedIdx.set(idx);
  }
}
