import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatToolbarModule } from '@angular/material/toolbar';

import { PlatformType, PlatFormTypes } from './core/models';
import { ExcelIoService } from './core/services/excel-io.service';
import { OrderImportService } from './core/services/order-import.service';
import { StoreService } from './core/services/store.service';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatToolbarModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly #storeService = inject(StoreService);
  readonly #excelIoService = inject(ExcelIoService);
  readonly #orderImportService = inject(OrderImportService);

  readonly state = this.#storeService.state;
  readonly isLoaded = this.#storeService.isLoaded;

  readonly selectedPlatform = signal<PlatformType>(PlatFormTypes.A);
  readonly busy = signal(false);
  readonly uiMessage = signal<string>('');
  readonly uiError = signal<string>('');

  readonly canDownloadErrorReport = computed(() => {
    const result = this.state().lastImportResult;
    return result !== null && result.errors.length > 0;
  });

  readonly dashboardStats = computed(() => {
    const state = this.state();

    return [
      { label: '商品總數', value: state.products.length },
      { label: '訂單總數', value: state.orders.length },
      { label: '進貨筆數', value: state.inbounds.length },
      { label: '未配對商品', value: state.unmatchedProducts.length },
    ];
  });

  createDataset(): void {
    this.#clearMessages();
    this.#storeService.createNewDataset(`dataset-${new Date().toISOString().slice(0, 10)}`);
    this.uiMessage.set('已建立空白資料集');
  }

  async handleSystemWorkbookSelected(event: Event): Promise<void> {
    this.#clearMessages();
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    fileInput.value = '';

    if (!file) {
      return;
    }

    this.busy.set(true);

    try {
      const loadedState = await this.#excelIoService.loadSystemWorkbook(file);
      this.#storeService.loadDataset(loadedState, this.#stripExtension(file.name));
      this.uiMessage.set(`已載入資料庫：${file.name}`);
    } catch (error) {
      this.uiError.set(this.#toErrorMessage(error, '載入資料庫失敗'));
    } finally {
      this.busy.set(false);
    }
  }

  exportSystemWorkbook(): void {
    this.#clearMessages();

    try {
      this.#excelIoService.downloadSystemWorkbook(this.#storeService.snapshot);
      this.#storeService.markSaved();
      this.uiMessage.set('資料庫已匯出並清除未保存狀態');
    } catch (error) {
      this.uiError.set(this.#toErrorMessage(error, '匯出資料庫失敗'));
    }
  }

  async handleOrderWorkbookSelected(event: Event): Promise<void> {
    this.#clearMessages();
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    fileInput.value = '';

    if (!file) {
      return;
    }

    this.busy.set(true);

    try {
      const output = await this.#orderImportService.importFromFile(
        file,
        this.selectedPlatform(),
        this.#storeService.snapshot,
      );

      this.#storeService.applyOrderImport(output);

      const result = output.result;
      this.uiMessage.set(
        `匯入完成：成功 ${result.importedCount}、重複 ${result.duplicateCount}、錯誤 ${result.errorCount}`,
      );
    } catch (error) {
      this.uiError.set(this.#toErrorMessage(error, '匯入訂單失敗'));
    } finally {
      this.busy.set(false);
    }
  }

  downloadErrorReport(): void {
    const result = this.state().lastImportResult;
    if (!result || result.errors.length === 0) {
      return;
    }

    this.#excelIoService.downloadImportErrors(result.errors);
  }

  setPlatform(value: string): void {
    if (value === PlatFormTypes.A || value === PlatFormTypes.B || value === PlatFormTypes.C) {
      this.selectedPlatform.set(value);
    }
  }

  #stripExtension(filename: string): string {
    return filename.replace(/\.[^.]+$/, '');
  }

  #toErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message.length > 0) {
      return error.message;
    }

    return fallback;
  }

  #clearMessages(): void {
    this.uiMessage.set('');
    this.uiError.set('');
  }
}
