import { Component, input, output } from '@angular/core';

import type { InventorySnapshot } from '../../../core/models';

@Component({
  selector: 'low-stock-card',
  imports: [],
  templateUrl: './low-stock-card.html',
})
export class LowStockCard {
  readonly products = input.required<InventorySnapshot[]>();
  readonly threshold = input.required<number>();

  readonly gotoRequested = output<void>();
}
