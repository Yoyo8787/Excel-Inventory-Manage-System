import { Component, computed, inject, signal } from '@angular/core';
import { nanoid } from 'nanoid';

import type { InboundRecord } from '../../core/models';
import { LayoutService, RecordImportService, StoreService } from '../../core/services';
import { toErrorMessage } from '../../core/utils';
import { InboundHistoryCard } from './inbound-history-card/inbound-history-card';
import { InboundManualCard } from './inbound-manual-card/inbound-manual-card';
import { InboundUploadCard } from './inbound-upload-card/inbound-upload-card';
import type { InboundBatchSection, InboundLine, InboundLineKey } from './import.types';

@Component({
  selector: 'page-import',
  imports: [InboundUploadCard, InboundManualCard, InboundHistoryCard],
  templateUrl: './import.page.html',
})
export class ImportPage {
  readonly #store = inject(StoreService);
  readonly #layout = inject(LayoutService);
  readonly #recordImport = inject(RecordImportService);

  readonly state = this.#store.state;
  readonly busy = signal(false);
  readonly confirmImportedAt = signal<string | null>(null);
  readonly lines = signal<InboundLine[]>([this.#blankLine()]);

  readonly productNameOptions = computed(() =>
    [...new Set(this.#store.standardProductKeys().map((item) => item.productName))].sort((a, b) =>
      a.localeCompare(b, 'zh-Hant'),
    ),
  );
  readonly productStyleOptions = computed(() =>
    [...new Set(this.#store.standardProductKeys().map((item) => item.productStyle))].sort((a, b) =>
      a.localeCompare(b, 'zh-Hant'),
    ),
  );
  readonly activeLineCount = computed(
    () => this.lines().filter((l) => !this.#isBlankLine(l)).length,
  );
  readonly totalQty = computed(() =>
    this.lines().reduce((s, l) => s + this.#positiveQty(l.qty), 0),
  );
  readonly importSummary = computed(() => {
    const result = this.state().lastImportResult;
    if (result?.type !== 'inbound') {
      return {
        importedCount: 0,
        errorCount: 0,
        errors: [],
      };
    }

    return {
      importedCount: result.importedCount,
      errorCount: result.errorCount,
      errors: result.errors,
    };
  });

  readonly batches = this.#store.inboundBatches;

  readonly inboundBatchSections = computed<InboundBatchSection[]>(() => {
    const recordsByImportedAt = new Map<string, InboundRecord[]>();

    for (const record of this.state().inbounds) {
      const records = recordsByImportedAt.get(record.importedAt) ?? [];
      records.push(record);
      recordsByImportedAt.set(record.importedAt, records);
    }

    return this.batches().map((batch) => ({
      ...batch,
      records: recordsByImportedAt.get(batch.importedAt) ?? [],
    }));
  });

  updateLine(i: number, key: InboundLineKey, v: string | number): void {
    this.lines.update((ls) =>
      ls.map((l, idx) => {
        if (idx !== i) return l;

        if (key === 'qty') {
          return { ...l, qty: this.#toQuantity(v) };
        }

        return { ...l, [key]: String(v) };
      }),
    );
  }

  addLine(): void {
    this.lines.update((ls) => [...ls, this.#blankLine()]);
  }

  rmLine(i: number): void {
    if (this.lines().length > 1) this.lines.update((ls) => ls.filter((_, idx) => idx !== i));
  }

  submit(): void {
    const formError = this.#formError();
    if (formError) {
      this.#layout.showMessage(formError);
      return;
    }

    const importedAt = new Date().toISOString();
    const records = this.#toInboundRecords(importedAt);

    this.#store.applyInboundImport({
      records,
      result: { type: 'inbound', importedCount: records.length, errorCount: 0, errors: [] },
    });
    this.#layout.showMessage(
      `入庫完成：${records.length} 項，共 ${this.totalQty().toLocaleString()} 件`,
    );
    this.lines.set([this.#blankLine()]);
  }

  async handleInboundWorkbookSelected(file: File): Promise<void> {
    this.busy.set(true);
    try {
      const output = await this.#recordImport.importInboundFromFile(file);
      this.#store.applyInboundImport(output);
      const result = output.result;
      if (result.importedCount === 0 && result.errorCount > 0) {
        this.#layout.showError(result.errors[0]?.reason ?? '匯入進貨失敗');
        return;
      }
      this.#layout.showMessage(
        `進貨匯入完成：成功 ${result.importedCount}、錯誤 ${result.errorCount}`,
      );
    } catch (error) {
      this.#layout.showError(toErrorMessage(error, '匯入進貨失敗'));
    } finally {
      this.busy.set(false);
    }
  }

  requestRemoveBatch(importedAt: string): void {
    this.confirmImportedAt.set(importedAt);
  }

  cancelRemoveBatch(): void {
    this.confirmImportedAt.set(null);
  }

  removeBatch(importedAt: string): void {
    const count = this.state().inbounds.filter((record) => record.importedAt === importedAt).length;
    this.confirmImportedAt.set(null);
    this.#store.removeInboundBatch(importedAt);
    this.#layout.showMessage(`已撤回進貨批次：${count} 筆`);
  }

  #blankLine(): InboundLine {
    return { productName: '', productStyle: '', qty: 0 };
  }

  #formError(): string | null {
    if (this.activeLineCount() === 0) {
      return '請至少輸入一筆商品項次';
    }

    for (const [index, line] of this.lines().entries()) {
      if (this.#isBlankLine(line)) continue;
      if (line.productName.trim().length === 0) {
        return `第 ${index + 1} 項商品名稱不可為空`;
      }
      if (line.productStyle.trim().length === 0) {
        return `第 ${index + 1} 項商品款式不可為空`;
      }
      if (this.#positiveQty(line.qty) <= 0) {
        return `第 ${index + 1} 項數量需大於 0`;
      }
    }

    return null;
  }

  #toInboundRecords(importedAt: string): InboundRecord[] {
    return this.lines()
      .filter((line) => !this.#isBlankLine(line))
      .map((line) => ({
        id: nanoid(12),
        productName: line.productName.trim(),
        productStyle: line.productStyle.trim(),
        quantity: this.#positiveQty(line.qty),
        importedAt,
      }));
  }

  #isBlankLine(line: InboundLine): boolean {
    return (
      line.productName.trim().length === 0 &&
      line.productStyle.trim().length === 0 &&
      this.#positiveQty(line.qty) === 0
    );
  }

  #toQuantity(value: string | number): number {
    const quantity = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
  }

  #positiveQty(value: number): number {
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  }
}
