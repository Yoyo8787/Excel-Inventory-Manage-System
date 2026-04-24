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

  readonly stats = computed(() => {
    const s = this.state();
    const todayOrders = s.orders.filter(o => o.orderDate === this.today);
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.amountTotal ?? 0), 0);
    const pendingOrders = s.orders.filter(o => o.status === '尚未出貨');

    return [
      {
        label: '訂單總數',
        valueStr: s.orders.length.toLocaleString(),
        sub: `今日新增 ${todayOrders.length} 筆`,
        tone: 'blue',
      },
      {
        label: '待出貨',
        valueStr: pendingOrders.length.toLocaleString(),
        sub: s.unmatchedProducts.length > 0
          ? `${s.unmatchedProducts.length} 項未配對`
          : '所有訂單已配對',
        tone: 'ochre',
      },
      {
        label: '庫存品項',
        valueStr: s.products.length.toLocaleString(),
        sub: `進貨紀錄 ${s.inbounds.length} 筆`,
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
    [...this.state().orders]
      .sort((a, b) => b.importedAt.localeCompare(a.importedAt))
      .slice(0, 8)
  );

  readonly unmatchedProducts = computed(() => this.state().unmatchedProducts);

  readonly inboundTotalQty = computed(() =>
    this.state().inbounds.reduce((s, r) => s + r.quantity, 0)
  );

  readonly orderStatusSummary = computed(() => {
    const orders = this.state().orders;
    return {
      pending:   orders.filter(o => o.status === '尚未出貨').length,
      shipped:   orders.filter(o => o.status === '已出貨').length,
      other:     orders.filter(o => o.status !== '尚未出貨' && o.status !== '已出貨').length,
    };
  });

  formatImportedAt(iso: string): string {
    return iso.replace('T', ' ').slice(0, 16);
  }

  sparkColor(tone: string): string {
    const map: Record<string, string> = {
      red: 'var(--danger)', ochre: 'var(--warn)', green: 'var(--mint-500)', blue: 'var(--info)',
    };
    return map[tone] ?? 'var(--mint-500)';
  }
}
