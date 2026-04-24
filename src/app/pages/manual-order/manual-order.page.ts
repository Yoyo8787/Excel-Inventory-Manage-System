import { Component, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { nanoid } from 'nanoid';

import { StoreService } from '../../core/services/store.service';
import { LayoutService } from '../../core/services/layout.service';
import { PlatFormTypes } from '../../core/models';
import type { PlatformType, Product } from '../../core/models';
import { ProductAutocompleteComponent } from '../../components/product-autocomplete/product-autocomplete';

interface LineItem { productId: string | null; qty: number; price: number; }

@Component({
  selector: 'page-manual-order',
  imports: [FormsModule, MatFormFieldModule, MatSelectModule, MatInputModule, ProductAutocompleteComponent],
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
  readonly lines = signal<LineItem[]>([{ productId: null, qty: 1, price: 0 }]);

  readonly products = computed(() =>
    [...this.state().products].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
  );

  readonly total = computed(() => this.lines().reduce((s, l) => s + l.qty * l.price, 0));

  getProductName(productId: string | null): string {
    if (!productId) return '—';
    return this.#getProduct(productId)?.name ?? productId;
  }

  updateLine(i: number, key: keyof LineItem, v: string | number | null): void {
    this.lines.update(ls => ls.map((l, idx) => {
      if (idx !== i) return l;

      if (key === 'productId') {
        return { ...l, productId: typeof v === 'string' && v.length > 0 ? v : null };
      }

      const value = typeof v === 'number' ? v : Number(v);
      const normalized = Number.isFinite(value) ? Math.max(0, value) : 0;
      return { ...l, [key]: normalized };
    }));
  }
  addLine(): void { this.lines.update(ls => [...ls, { productId: null, qty: 1, price: 0 }]); }
  rmLine(i: number): void { this.lines.update(ls => ls.filter((_, idx) => idx !== i)); }

  submit(): void {
    const lineError = this.#firstLineError();
    if (lineError) {
      this.#layout.showMessage(lineError);
      return;
    }

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
          platformProductName: this.getProductName(l.productId),
          quantity: l.qty,
          unitPrice: l.price,
          subtotal: l.qty * l.price,
          mappedItems: [],
          isMatched: false,
        })),
      }],
    });
    this.#layout.showMessage(`訂單 ${no} 已建立`);
    this.lines.set([{ productId: null, qty: 1, price: 0 }]);
    this.orderNo.set('');
  }

  #firstLineError(): string | null {
    if (this.products().length === 0) {
      return '請先在商品管理新增商品，再建立手動訂單';
    }

    for (const [index, line] of this.lines().entries()) {
      if (!line.productId || !this.#getProduct(line.productId)) {
        return `第 ${index + 1} 項請選擇既有商品`;
      }

      if (!Number.isFinite(line.qty) || line.qty <= 0) {
        return `第 ${index + 1} 項數量需大於 0`;
      }
    }

    return null;
  }

  #getProduct(productId: string): Product | undefined {
    return this.state().products.find(p => p.id === productId);
  }
}
