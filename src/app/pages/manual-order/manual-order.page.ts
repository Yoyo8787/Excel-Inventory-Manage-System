import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { nanoid } from 'nanoid';

import { OutboundRecord } from '../../core/models';
import { LayoutService, StoreService } from '../../core/services';

interface LineItem {
  productName: string;
  productStyle: string;
  qty: number;
}

type LineItemKey = 'productName' | 'productStyle' | 'qty';

@Component({
  selector: 'page-manual-order',
  imports: [FormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './manual-order.page.html',
})
export class ManualOrderPage {
  readonly #store = inject(StoreService);
  readonly #layout = inject(LayoutService);

  readonly state = this.#store.state;

  readonly recipientName = signal('');
  readonly lines = signal<LineItem[]>([this.#blankLine()]);

  readonly productNameOptions = computed(() =>
    [...new Set(this.#knownProductKeys().map((item) => item.productName))].sort((a, b) =>
      a.localeCompare(b, 'zh-Hant'),
    ),
  );
  readonly productStyleOptions = computed(() =>
    [...new Set(this.#knownProductKeys().map((item) => item.productStyle).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b, 'zh-Hant'),
    ),
  );
  readonly activeLineCount = computed(() => this.lines().filter((line) => !this.#isBlankLine(line)).length);
  readonly totalQty = computed(() =>
    this.lines().reduce((sum, line) => sum + this.#toPositiveInteger(line.qty), 0),
  );

  updateLine(i: number, key: LineItemKey, v: string | number): void {
    this.lines.update(ls => ls.map((l, idx) => {
      if (idx !== i) return l;

      if (key === 'qty') {
        const value = typeof v === 'number' ? v : Number(v);
        return { ...l, qty: this.#toPositiveInteger(value) };
      }

      return { ...l, [key]: String(v) };
    }));
  }

  addLine(): void {
    this.lines.update(ls => [...ls, this.#blankLine()]);
  }

  rmLine(i: number): void {
    if (this.lines().length > 1) {
      this.lines.update(ls => ls.filter((_, idx) => idx !== i));
    }
  }

  submit(): void {
    const error = this.#formError();
    if (error) {
      this.#layout.showMessage(error);
      return;
    }

    const importedAt = new Date().toISOString();
    const records = this.#toOutboundRecords(importedAt);

    this.#store.applyOutboundImport({
      records,
      result: { type: 'outbound', importedCount: records.length, errorCount: 0, errors: [] },
    });
    this.#layout.showMessage(`出貨已建立：${records.length} 項，共 ${this.totalQty().toLocaleString()} 件`);
    this.lines.set([this.#blankLine()]);
    this.recipientName.set('');
  }

  #formError(): string | null {
    if (this.recipientName().trim().length === 0) {
      return '請輸入收件人名稱';
    }

    if (this.activeLineCount() === 0) {
      return '請至少輸入一筆商品項次';
    }

    for (const [index, line] of this.lines().entries()) {
      if (this.#isBlankLine(line)) continue;

      if (line.productName.trim().length === 0) {
        return `第 ${index + 1} 項商品名稱不可為空`;
      }

      if (this.#toPositiveInteger(line.qty) <= 0) {
        return `第 ${index + 1} 項數量需大於 0`;
      }
    }

    return null;
  }

  #toOutboundRecords(importedAt: string): OutboundRecord[] {
    return this.lines()
      .filter((line) => !this.#isBlankLine(line))
      .map((line) => ({
        id: nanoid(12),
        productName: line.productName.trim(),
        productStyle: line.productStyle.trim(),
        quantity: this.#toPositiveInteger(line.qty),
        recipientName: this.recipientName().trim(),
        importedAt,
      }));
  }

  #knownProductKeys() {
    return [
      ...this.#store.standardProductKeys(),
      ...this.state().outbounds.map((record) => ({
        productName: record.productName,
        productStyle: record.productStyle,
      })),
    ];
  }

  #blankLine(): LineItem {
    return { productName: '', productStyle: '', qty: 1 };
  }

  #isBlankLine(line: LineItem): boolean {
    return line.productName.trim().length === 0 &&
      line.productStyle.trim().length === 0;
  }

  #toPositiveInteger(value: number): number {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
}
