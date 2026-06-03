import { Component, input } from '@angular/core';

@Component({
  selector: 'inventory-summary-card',
  imports: [],
  templateUrl: './inventory-summary-card.html',
})
export class InventorySummaryCard {
  readonly inventoryCount = input.required<number>();
  readonly mappingCount = input.required<number>();
  readonly unmatchedCount = input.required<number>();
}
