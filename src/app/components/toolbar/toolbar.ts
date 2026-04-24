import { Component, computed, inject, input, output } from '@angular/core';

import { LayoutService } from '../../core/services/layout.service';
import { MenuItem } from '../sidenav/menu';

@Component({
  selector: 'app-toolbar',
  imports: [],
  templateUrl: './toolbar.html',
})
export class Toolbar {
  readonly isDirty = input(false);
  readonly lastSavedAt = input<string | null>(null);
  readonly saved = output<void>();

  readonly layoutService = inject(LayoutService);

  readonly pageLabel = computed(() => {
    const page = this.layoutService.page();
    return MenuItem.find(m => m.route === page)?.label ?? '控制面板';
  });

  onSave(): void {
    this.saved.emit();
  }
}
