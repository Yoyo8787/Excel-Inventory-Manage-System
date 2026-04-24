import { Component, computed, inject, output } from '@angular/core';

import { StoreService } from '../../core/services/store.service';

@Component({
  selector: 'page-dashboard',
  imports: [],
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {
  readonly #store = inject(StoreService);
  readonly state = this.#store.state;
  readonly goto = output<string>();

  private readonly today = new Date().toISOString().slice(0, 10);

  readonly inventorySnapshots = this.#store.inventorySnapshots;
  readonly lowStockProducts = computed(() => this.#store.lowStockProducts());
  readonly unmatchedProducts = this.#store.unmatchedProducts;

  readonly stats = computed(() => {
    const s = this.state();
    const todayOrders = s.orders.filter((o) => o.orderDate.slice(0, 10) === this.today);
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.amountTotal ?? 0), 0);
    const onHandTotal = this.inventorySnapshots().reduce((sum, item) => sum + item.onHand, 0);

    return [
      {
        label: '訂單總數',
        valueStr: s.orders.length.toLocaleString(),
        sub: `今日新增 ${todayOrders.length} 筆`,
        tone: 'blue',
      },
      {
        label: '目前庫存',
        valueStr: onHandTotal.toLocaleString(),
        sub: `共 ${s.products.length} 項產品`,
        tone: 'ochre',
      },
      {
        label: '低庫存',
        valueStr: this.lowStockProducts().length.toLocaleString(),
        sub: `${this.unmatchedProducts().length} 項未配對`,
        tone: 'green',
      },
      {
        label: '今日營收',
        valueStr: `$ ${todayRevenue.toLocaleString()}`,
        sub: `共 ${todayOrders.length} 筆訂單`,
        tone: 'red',
      },
    ];
  });

  readonly recentOrders = computed(() =>
    [...this.state().orders].sort((a, b) => b.importedAt.localeCompare(a.importedAt)).slice(0, 8),
  );

  readonly inboundTotalQty = computed(() =>
    this.state().inbounds.reduce((s, r) => s + r.quantity, 0),
  );

  lowStockThreshold(productId: string): number {
    return this.state().products.find((product) => product.id === productId)?.lowStockThreshold ?? 0;
  }

  formatImportedAt(iso: string): string {
    return iso.replace('T', ' ').slice(0, 16);
  }
}
