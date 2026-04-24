import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { nanoid } from 'nanoid';

import { StoreService } from '../../core/services/store.service';
import { LayoutService } from '../../core/services/layout.service';
import type { InboundRecord, Product } from '../../core/models';
import { ProductAutocompleteComponent } from '../../components/product-autocomplete/product-autocomplete';

interface InboundLine {
  productId: string | null;
  qty: number;
}

type InboundLineKey = 'productId' | 'qty';

@Component({
  selector: 'page-import',
  imports: [FormsModule, MatFormFieldModule, MatInputModule, ProductAutocompleteComponent],
  templateUrl: './import.page.html',
})
export class ImportPage {
  readonly #store = inject(StoreService);
  readonly #layout = inject(LayoutService);

  readonly state = this.#store.state;
  readonly date = signal(new Date().toISOString().slice(0, 10));
  readonly note = signal('');
  readonly lines = signal<InboundLine[]>([this.#blankLine()]);

  readonly products = computed(() =>
    [...this.state().products].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
  );
  readonly activeLineCount = computed(() => this.lines().filter(l => !this.#isBlankLine(l)).length);
  readonly totalQty = computed(() => this.lines().reduce((s, l) => s + this.#positiveQty(l.qty), 0));

  readonly inboundHistory = computed(() =>
    [...this.state().inbounds]
      .sort((a, b) =>
        b.inboundDate.localeCompare(a.inboundDate) || b.createdAt.localeCompare(a.createdAt)
      )
      .slice(0, 20)
  );

  getProductName(productId: string): string {
    return this.state().products.find(p => p.id === productId)?.name ?? productId;
  }

  updateLine(i: number, key: InboundLineKey, v: string | number | null): void {
    this.lines.update(ls => ls.map((l, idx) => {
      if (idx !== i) return l;

      return key === 'qty'
        ? { ...l, qty: this.#toQuantity(v) }
        : { ...l, productId: typeof v === 'string' && v.length > 0 ? v : null };
    }));
  }

  addLine(): void {
    this.lines.update(ls => [...ls, this.#blankLine()]);
  }

  rmLine(i: number): void {
    if (this.lines().length > 1) this.lines.update(ls => ls.filter((_, idx) => idx !== i));
  }

  submit(): void {
    const formError = this.#formError();
    if (formError) {
      this.#layout.showMessage(formError);
      return;
    }

    const now = new Date().toISOString();
    const note = this.note().trim() || undefined;
    const records = this.#toInboundRecords(now, note);

    this.#store.applyInbound(records);
    this.#layout.showMessage(`入庫完成：${records.length} 項，共 ${this.totalQty().toLocaleString()} 件`);
    this.lines.set([this.#blankLine()]);
    this.note.set('');
  }

  #blankLine(): InboundLine {
    return { productId: null, qty: 0 };
  }

  #findProduct(line: InboundLine): Product | undefined {
    const products = this.state().products;

    if (line.productId) {
      return products.find(p => p.id === line.productId);
    }

    return undefined;
  }

  #formError(): string | null {
    if (this.products().length === 0) {
      return '請先在商品管理新增商品，再建立進貨紀錄';
    }

    if (!this.#isValidDate(this.date())) {
      return '請輸入有效的進貨日期';
    }

    if (this.activeLineCount() === 0) {
      return '請至少輸入一筆商品項次';
    }

    return this.#firstLineError();
  }

  #firstLineError(): string | null {
    for (const [index, line] of this.lines().entries()) {
      if (this.#isBlankLine(line)) continue;
      if (!this.#findProduct(line)) {
        return `第 ${index + 1} 項請選擇既有商品`;
      }
      if (this.#positiveQty(line.qty) <= 0) {
        return `第 ${index + 1} 項數量需大於 0`;
      }
    }

    return null;
  }

  #toInboundRecords(createdAt: string, note: string | undefined): InboundRecord[] {
    return this.lines()
      .filter(line => !this.#isBlankLine(line))
      .map(line => {
        const product = this.#findProduct(line);
        if (!product) {
          throw new Error('Import line has no matching product');
        }

        return {
          id: nanoid(),
          productId: product.id,
          quantity: this.#positiveQty(line.qty),
          inboundDate: this.date(),
          note,
          createdAt,
        };
      });
  }

  #isBlankLine(line: InboundLine): boolean {
    return !line.productId &&
      this.#positiveQty(line.qty) === 0;
  }

  #toQuantity(value: string | number | null): number {
    const quantity = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(quantity) ? Math.max(0, quantity) : 0;
  }

  #positiveQty(value: number): number {
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  #isValidDate(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
  }
}
