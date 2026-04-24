import { Component, inject, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';

import { StoreService } from '../../core/services/store.service';

@Component({
  selector: 'page-settings',
  imports: [MatFormFieldModule, MatSelectModule, MatCheckboxModule, MatInputModule],
  templateUrl: './settings.page.html',
})
export class SettingsPage {
  readonly #store = inject(StoreService);
  readonly state = this.#store.state;

  /** 欄位對應表 — 各平台 Excel 欄位名稱至系統欄位的映射設定 */
  readonly platformMappings = [
    {
      plat: '好蒔光',
      fields: [
        ['訂單編號', '訂單號碼'],
        ['商品名稱', '品項'],
        ['金額', '應付'],
      ],
    },
    {
      plat: '仙姑',
      fields: [
        ['訂單編號', '單號'],
        ['商品名稱', '商品'],
        ['金額', '總額'],
      ],
    },
    {
      plat: '綠崎',
      fields: [
        ['訂單編號', 'OrderID'],
        ['商品名稱', 'Product Name'],
        ['金額', 'Total'],
      ],
    },
  ];

  // 功能開關
  readonly autoDeductStock = signal(true);
  readonly showLowStockAlert = signal(true);
  readonly allowNegativeStock = signal(false);
  readonly showAlternateRows = signal(true);

  updateDefaultLowStockThreshold(value: string | number): void {
    const parsed = typeof value === 'number' ? value : Number(value);
    this.#store.updateDefaultLowStockThreshold(parsed);
  }
}
