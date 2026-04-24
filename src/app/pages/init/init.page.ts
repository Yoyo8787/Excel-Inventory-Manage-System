import { Component, inject, signal } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';

import { StoreService, ExcelIoService, LayoutService } from '../../core/services';
import { toErrorMessage, stripExtension } from '../../core/utils';

@Component({
  selector: 'app-init',
  templateUrl: './init.page.html',
  imports: [],
})
export class InitPage {
  readonly #storeService = inject(StoreService);
  readonly #excelIoService = inject(ExcelIoService);
  readonly #layoutService = inject(LayoutService);
  readonly #dialogRef = inject(MatDialogRef<InitPage>);

  readonly busy = signal(false);

  createDataset(): void {
    this.#storeService.createNewDataset(`dataset-${new Date().toISOString().slice(0, 10)}`);
    this.#layoutService.showMessage('已建立新資料集');
    this.#dialogRef.close();
  }

  async handleSystemWorkbookSelected(event: Event): Promise<void> {
    const fileInput = event.target as HTMLInputElement;
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;

    this.busy.set(true);
    try {
      const loadedState = await this.#excelIoService.loadSystemWorkbook(file);
      this.#storeService.loadDataset(loadedState, stripExtension(file.name));
      this.#layoutService.showMessage(`已載入資料庫：${file.name}`);
      this.#dialogRef.close();
    } catch (error) {
      this.#layoutService.showError(toErrorMessage(error, '載入資料庫失敗'));
    } finally {
      this.busy.set(false);
    }
  }
}
