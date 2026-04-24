import { Component, inject } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { StoreService } from '../../core/services/store.service';

@Component({
  selector: 'page-settings',
  imports: [MatFormFieldModule, MatInputModule],
  templateUrl: './settings.page.html',
})
export class SettingsPage {
  readonly #store = inject(StoreService);
  readonly state = this.#store.state;

  updateDefaultLowStockThreshold(value: string | number): void {
    const parsed = typeof value === 'number' ? value : Number(value);
    this.#store.updateDefaultLowStockThreshold(parsed);
  }
}
