import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { StoreService } from '../../core/services/store.service';
import { LayoutService } from '../../core/services/layout.service';

interface InboundLine { sku: string; name: string; qty: number; price: number; }

@Component({
  selector: 'page-import',
  imports: [FormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './import.page.html',
})
export class ImportPage {
  readonly #store = inject(StoreService);
  readonly #layout = inject(LayoutService);

  readonly state = this.#store.state;
  readonly supplier = signal('');
  readonly date = signal(new Date().toISOString().slice(0, 10));
  readonly note = signal('');
  readonly lines = signal<InboundLine[]>([{ sku: '', name: '', qty: 0, price: 0 }]);

  readonly total = computed(() => this.lines().reduce((s, l) => s + l.qty * l.price, 0));
  readonly totalQty = computed(() => this.lines().reduce((s, l) => s + l.qty, 0));

  readonly inboundHistory = computed(() =>
    [...this.state().inbounds]
      .sort((a, b) => b.inboundDate.localeCompare(a.inboundDate))
      .slice(0, 20)
  );

  getProductName(productId: string): string {
    return this.state().products.find(p => p.id === productId)?.name ?? productId;
  }

  updateLine(i: number, key: keyof InboundLine, v: string | number): void {
    this.lines.update(ls => ls.map((l, idx) => idx === i ? { ...l, [key]: v } : l));
  }
  addLine(): void { this.lines.update(ls => [...ls, { sku: '', name: '', qty: 0, price: 0 }]); }
  rmLine(i: number): void {
    if (this.lines().length > 1) this.lines.update(ls => ls.filter((_, idx) => idx !== i));
  }

  submit(): void {
    // TODO: 串接 StoreService.applyInbound() 待後端實作
    this.#layout.showMessage(`進貨單已建立：共 ${this.lines().length} 項，金額 $${this.total().toLocaleString()}`);
    this.lines.set([{ sku: '', name: '', qty: 0, price: 0 }]);
    this.note.set('');
    this.supplier.set('');
  }
}
