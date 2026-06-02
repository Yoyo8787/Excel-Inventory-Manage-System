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
  readonly unmatchedOutbounds = this.#store.unmatchedOutbounds;

  readonly stats = computed(() => {
    const s = this.state();
    const todayOutbounds = s.outbounds.filter((record) => record.importedAt.slice(0, 10) === this.today);
    const onHandTotal = this.inventorySnapshots().reduce((sum, item) => sum + item.onHand, 0);

    return [
      {
        label: '出貨紀錄',
        valueStr: s.outbounds.length.toLocaleString(),
        sub: `今日匯入 ${todayOutbounds.length} 筆`,
        tone: 'blue',
      },
      {
        label: '目前庫存',
        valueStr: onHandTotal.toLocaleString(),
        sub: `共 ${this.inventorySnapshots().length} 項品項`,
        tone: 'ochre',
      },
      {
        label: '低庫存',
        valueStr: this.lowStockProducts().length.toLocaleString(),
        sub: `${this.unmatchedOutbounds().length} 筆未配對`,
        tone: 'green',
      },
      {
        label: '進貨紀錄',
        valueStr: s.inbounds.length.toLocaleString(),
        sub: `共 ${this.inboundTotalQty().toLocaleString()} 件`,
        tone: 'red',
      },
    ];
  });

  readonly recentOutbounds = computed(() =>
    [...this.state().outbounds].sort((a, b) => b.importedAt.localeCompare(a.importedAt)).slice(0, 8),
  );

  readonly inboundTotalQty = computed(() =>
    this.state().inbounds.reduce((s, r) => s + r.quantity, 0),
  );

  formatImportedAt(iso: string): string {
    return iso.replace('T', ' ').slice(0, 16);
  }
}
