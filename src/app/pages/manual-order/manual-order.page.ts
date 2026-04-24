import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { nanoid } from 'nanoid';

import { StoreService } from '../../core/services/store.service';
import { LayoutService } from '../../core/services/layout.service';
import { PlatformType, PlatFormTypes } from '../../core/models';

interface LineItem { sku: string; qty: number; price: number; }

@Component({
  selector: 'page-manual-order',
  imports: [FormsModule, MatFormFieldModule, MatSelectModule, MatInputModule],
  templateUrl: './manual-order.page.html',
})
export class ManualOrderPage {
  readonly #store = inject(StoreService);
  readonly #layout = inject(LayoutService);

  readonly state = this.#store.state;

  readonly platforms: PlatformType[] = [
    PlatFormTypes.A, PlatFormTypes.B, PlatFormTypes.C,
    '電話訂購' as PlatformType, '線下零售' as PlatformType,
  ];

  readonly platform = signal<PlatformType>(PlatFormTypes.A);
  readonly orderNo = signal('');
  readonly buyer = signal('');
  readonly phone = signal('');
  readonly addr = signal('');
  readonly lines = signal<LineItem[]>([{ sku: '', qty: 1, price: 0 }]);

  readonly total = computed(() => this.lines().reduce((s, l) => s + l.qty * l.price, 0));

  /** 依 SKU 查詢商品名稱；找不到則回傳 SKU 本身 */
  getProductName(sku: string): string {
    if (!sku) return '—';
    return this.state().products.find(p => p.sku === sku)?.name ?? sku;
  }

  updateLine(i: number, key: keyof LineItem, v: string | number): void {
    this.lines.update(ls => ls.map((l, idx) => idx === i ? { ...l, [key]: v } : l));
  }
  addLine(): void { this.lines.update(ls => [...ls, { sku: '', qty: 1, price: 0 }]); }
  rmLine(i: number): void { this.lines.update(ls => ls.filter((_, idx) => idx !== i)); }

  submit(): void {
    const no = this.orderNo() || `MN-${Math.floor(Math.random() * 90000 + 10000)}`;
    const now = new Date().toISOString();
    this.#store.applyOrderImport({
      result: { importedCount: 1, duplicateCount: 0, errorCount: 0, errors: [] },
      orders: [{
        id: nanoid(12),
        platform: this.platform(),
        orderNo: no,
        orderDate: now.slice(0, 10),
        statusRaw: '手動輸入',
        status: '尚未出貨',
        customerName: this.buyer(),
        customerPhone: this.phone(),
        address: this.addr(),
        amountTotal: this.total(),
        importedAt: now,
        lines: this.lines().map((l) => ({
          lineId: nanoid(8),
          platformProductName: this.getProductName(l.sku),
          quantity: l.qty,
          unitPrice: l.price,
          subtotal: l.qty * l.price,
          mappedItems: [],
          isMatched: false,
        })),
      }],
    });
    this.#layout.showMessage(`訂單 ${no} 已建立`);
    this.lines.set([{ sku: '', qty: 1, price: 0 }]);
    this.orderNo.set('');
  }
}
