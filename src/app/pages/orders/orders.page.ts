import { Component, computed, inject, signal } from '@angular/core';

import { Dropzone } from '../../components/dropzone/dropzone';
import { OrderTable } from '../../components/order-table/order-table';

import { PlatformType, PlatFormTypes } from '../../core/models';
import type { Order } from '../../core/models';
import { OrderImportService } from '../../core/services/order-import.service';
import { StoreService } from '../../core/services/store.service';
import { LayoutService } from '../../core/services';
import { toErrorMessage } from '../../core/utils';

@Component({
  selector: 'page-orders',
  imports: [Dropzone, OrderTable],
  templateUrl: './orders.page.html',
})
export class OrdersPage {
  readonly #storeService = inject(StoreService);
  readonly #orderImportService = inject(OrderImportService);
  readonly #layoutService = inject(LayoutService);

  readonly state = this.#storeService.state;
  readonly busy = signal(false);
  readonly orders = computed(() => this.state().orders);
  readonly importSummary = computed(() => {
    const result = this.state().lastImportResult;
    return {
      importedCount: result?.importedCount ?? 0,
      duplicateCount: result?.duplicateCount ?? 0,
      errorCount: result?.errorCount ?? 0,
      errors: result?.errors ?? [],
    };
  });

  readonly platformEntries = [
    { key: PlatFormTypes.A, label: '好蒔光' },
    { key: PlatFormTypes.B, label: '仙姑' },
    { key: PlatFormTypes.C, label: '綠崎' },
  ];
  readonly selectedPlatform = signal<PlatformType>(PlatFormTypes.A);

  setPlatform(key: string): void {
    if (key === PlatFormTypes.A || key === PlatFormTypes.B || key === PlatFormTypes.C) {
      this.selectedPlatform.set(key);
    }
  }

  async handleOrderWorkbookSelected(file: File): Promise<void> {
    this.busy.set(true);
    try {
      const output = await this.#orderImportService.importFromFile(
        file, this.selectedPlatform(), this.#storeService.snapshot,
      );
      this.#storeService.applyOrderImport(output);
      const result = output.result;
      if (result.importedCount === 0 && result.errorCount > 0) {
        this.#layoutService.showError(result.errors[0]?.reason ?? '匯入訂單失敗');
        return;
      }
      this.#layoutService.showMessage(
        `匯入完成：成功 ${result.importedCount}、重複 ${result.duplicateCount}、錯誤 ${result.errorCount}`,
      );
    } catch (error) {
      this.#layoutService.showError(toErrorMessage(error, '匯入訂單失敗'));
    } finally {
      this.busy.set(false);
    }
  }

  deleteOrder(order: Order): void {
    this.#storeService.deleteOrder(order.id);
    this.#layoutService.showMessage(`已刪除訂單：${order.orderNo}`);
  }
}
