import { Component, computed, inject, signal } from '@angular/core';

import { Dropzone } from '../../components/dropzone/dropzone';
import { OutboundTable } from '../../components/order-table/order-table';

import type { OutboundRecord } from '../../core/models';
import { RecordImportService } from '../../core/services/record-import.service';
import { StoreService } from '../../core/services/store.service';
import { LayoutService } from '../../core/services';
import { toErrorMessage } from '../../core/utils';

@Component({
  selector: 'page-orders',
  imports: [Dropzone, OutboundTable],
  templateUrl: './orders.page.html',
})
export class OrdersPage {
  readonly #storeService = inject(StoreService);
  readonly #recordImportService = inject(RecordImportService);
  readonly #layoutService = inject(LayoutService);

  readonly state = this.#storeService.state;
  readonly busy = signal(false);
  readonly records = computed(() =>
    [...this.state().outbounds].sort((a, b) => b.importedAt.localeCompare(a.importedAt)),
  );
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

  removeBatch(importedAt: string): void {
    const count = this.state().outbounds.filter((record) => record.importedAt === importedAt).length;
    this.#storeService.removeOutboundBatch(importedAt);
    this.#layoutService.showMessage(`已撤回出貨批次：${count} 筆`);
  }

  trackRecord(_index: number, record: OutboundRecord): string {
    return record.id;
  }
}
