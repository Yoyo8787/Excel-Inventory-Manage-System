import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatListModule } from '@angular/material/list';

import { Dropzone } from '../../components/dropzone/dropzone';
import { OrderTable } from '../../components/order-table/order-table';

import { PlatformType, PlatFormTypes } from '../../core/models';
import { OrderImportService } from '../../core/services/order-import.service';
import { StoreService } from '../../core/services/store.service';
import { LayoutService } from '../../core/services';

import { toErrorMessage } from '../../core/utils';

@Component({
  selector: 'page-orders',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatSelectModule,
    MatListModule,
    MatExpansionModule,
    Dropzone,
    OrderTable,
  ],
  templateUrl: './orders.page.html',
})
export class OrdersPage {
  readonly #storeService = inject(StoreService);
  readonly #orderImportService = inject(OrderImportService);
  readonly #layoutService = inject(LayoutService);

  readonly state = this.#storeService.state;
  readonly busy = signal(false);
  readonly orders = computed(() => this.state().orders);

  readonly PlatFormTypes = PlatFormTypes;
  readonly selectedPlatform = signal<PlatformType>(PlatFormTypes.A);
  setPlatform(value: string): void {
    if (value === PlatFormTypes.A || value === PlatFormTypes.B || value === PlatFormTypes.C) {
      this.selectedPlatform.set(value);
    }
  }

  async handleOrderWorkbookSelected(file: File): Promise<void> {
    this.busy.set(true);

    try {
      const output = await this.#orderImportService.importFromFile(
        file,
        this.selectedPlatform(),
        this.#storeService.snapshot,
      );

      this.#storeService.applyOrderImport(output);

      const result = output.result;
      this.#layoutService.showMessage(
        `匯入完成：成功 ${result.importedCount}、重複 ${result.duplicateCount}、錯誤 ${result.errorCount}`,
      );
    } catch (error) {
      this.#layoutService.showError(toErrorMessage(error, '匯入訂單失敗'));
    } finally {
      this.busy.set(false);
    }
  }
}
