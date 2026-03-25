import { Component, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';

import { StoreService } from '../../core/services/store.service';

@Component({
  selector: 'page-dashboard',
  imports: [CommonModule, MatCardModule, MatListModule],
  templateUrl: './dashboard.page.html',
})
export class DashboardPage {
  readonly #storeService = inject(StoreService);
  readonly state = this.#storeService.state;

  readonly dashboardStats = computed(() => {
    const state = this.state();

    return [
      { label: '商品總數', value: state.products.length },
      { label: '訂單總數', value: state.orders.length },
      { label: '進貨筆數', value: state.inbounds.length },
      { label: '未配對商品', value: state.unmatchedProducts.length },
    ];
  });
}
