import { Component, input } from '@angular/core';

import type { InventorySnapshot } from '../../../core/models';

@Component({
  selector: 'inventory-snapshot-card',
  imports: [],
  templateUrl: './inventory-snapshot-card.html',
})
export class InventorySnapshotCard {
  readonly items = input.required<InventorySnapshot[]>();
  readonly threshold = input.required<number>();
}
