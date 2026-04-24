import { Component, computed, inject, input } from '@angular/core';

import { LayoutService } from '../../core/services/layout.service';
import { MenuItem } from '../sidenav/menu';
import { ExcelIoService, StoreService } from '../../core/services';

@Component({
  selector: 'app-toolbar',
  imports: [],
  templateUrl: './toolbar.html',
})
export class Toolbar {
  readonly isDirty = input(false);
  readonly lastSavedAt = input<string | null>(null);

  readonly storeService = inject(StoreService);
  readonly layoutService = inject(LayoutService);
  readonly excelIOService = inject(ExcelIoService);

  readonly state = computed(() => this.storeService.state());

  readonly pageLabel = computed(() => {
    const page = this.layoutService.page();
    return MenuItem.find((m) => m.route === page)?.label ?? '控制面板';
  });

  onSave(): void {
    this.excelIOService.downloadSystemWorkbook(this.state());
  }
}
