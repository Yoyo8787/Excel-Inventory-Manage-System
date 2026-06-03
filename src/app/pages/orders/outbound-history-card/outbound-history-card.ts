import { Component, input, output } from '@angular/core';

import { OutboundBatchSection } from '../outbound-batch-section/outbound-batch-section';
import type { OutboundBatchSection as OutboundBatchSectionData } from '../orders.types';

@Component({
  selector: 'outbound-history-card',
  imports: [OutboundBatchSection],
  templateUrl: './outbound-history-card.html',
})
export class OutboundHistoryCard {
  readonly totalCount = input.required<number>();
  readonly batchCount = input.required<number>();
  readonly sections = input.required<OutboundBatchSectionData[]>();
  readonly confirmImportedAt = input<string | null>(null);

  readonly removeRequested = output<string>();
  readonly removeCanceled = output<void>();
  readonly removeConfirmed = output<string>();
}
