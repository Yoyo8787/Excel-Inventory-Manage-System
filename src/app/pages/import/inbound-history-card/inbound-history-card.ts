import { Component, input, output } from '@angular/core';

import { InboundBatchSection } from '../inbound-batch-section/inbound-batch-section';
import type { InboundBatchSection as InboundBatchSectionData } from '../import.types';

@Component({
  selector: 'inbound-history-card',
  imports: [InboundBatchSection],
  templateUrl: './inbound-history-card.html',
})
export class InboundHistoryCard {
  readonly totalCount = input.required<number>();
  readonly batchCount = input.required<number>();
  readonly sections = input.required<InboundBatchSectionData[]>();
  readonly confirmImportedAt = input<string | null>(null);

  readonly removeRequested = output<string>();
  readonly removeCanceled = output<void>();
  readonly removeConfirmed = output<string>();
}
