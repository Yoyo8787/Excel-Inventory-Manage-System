import { Component, computed, inject, signal } from '@angular/core';

import type { OutboundRecord } from '../../core/models';
import { RecordImportService } from '../../core/services/record-import.service';
import { StoreService } from '../../core/services/store.service';
import { LayoutService } from '../../core/services';
import { toErrorMessage } from '../../core/utils';
import { OutboundHistoryCard } from './outbound-history-card/outbound-history-card';
import { OutboundResultCard } from './outbound-result-card/outbound-result-card';
import { OutboundUploadCard } from './outbound-upload-card/outbound-upload-card';
import type { OutboundBatchSection } from './orders.types';

@Component({
  selector: 'page-orders',
  imports: [OutboundUploadCard, OutboundResultCard, OutboundHistoryCard],
  templateUrl: './orders.page.html',
})
export class OrdersPage {
  readonly #storeService = inject(StoreService);
  readonly #recordImportService = inject(RecordImportService);
  readonly #layoutService = inject(LayoutService);

  readonly state = this.#storeService.state;
  readonly busy = signal(false);
  readonly confirmImportedAt = signal<string | null>(null);
  readonly batches = this.#storeService.outboundBatches;
  readonly importSummary = computed(() => {
    const result = this.state().lastImportResult;
    if (result?.type !== 'outbound') {
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
  readonly outboundBatchSections = computed<OutboundBatchSection[]>(() => {
    const recordsByImportedAt = new Map<string, OutboundRecord[]>();

    for (const record of this.state().outbounds) {
      const records = recordsByImportedAt.get(record.importedAt) ?? [];
      records.push(record);
      recordsByImportedAt.set(record.importedAt, records);
    }

    return this.batches().map((batch) => ({
      ...batch,
      records: recordsByImportedAt.get(batch.importedAt) ?? [],
    }));
  });

  async handleOutboundWorkbookSelected(file: File): Promise<void> {
    this.busy.set(true);
    try {
      const output = await this.#recordImportService.importOutboundFromFile(file);
      this.#storeService.applyOutboundImport(output);
      const result = output.result;
      if (result.importedCount === 0 && result.errorCount > 0) {
        this.#layoutService.showError(result.errors[0]?.reason ?? '匯入出貨失敗');
        return;
      }
      this.#layoutService.showMessage(
        `匯入完成：成功 ${result.importedCount}、錯誤 ${result.errorCount}`,
      );
    } catch (error) {
      this.#layoutService.showError(toErrorMessage(error, '匯入出貨失敗'));
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
    const count = this.state().outbounds.filter(
      (record) => record.importedAt === importedAt,
    ).length;
    this.confirmImportedAt.set(null);
    this.#storeService.removeOutboundBatch(importedAt);
    this.#layoutService.showMessage(`已撤回出貨批次：${count} 筆`);
  }
}
