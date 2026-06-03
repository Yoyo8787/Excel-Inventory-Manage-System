import { Component, input, output, signal } from '@angular/core';

import type { OutboundBatchSection as OutboundBatchSectionData } from '../orders.types';

@Component({
  selector: 'outbound-batch-section',
  imports: [],
  templateUrl: './outbound-batch-section.html',
})
export class OutboundBatchSection {
  readonly section = input.required<OutboundBatchSectionData>();
  readonly confirmImportedAt = input<string | null>(null);

  readonly removeRequested = output<string>();
  readonly removeCanceled = output<void>();
  readonly removeConfirmed = output<string>();

  readonly expanded = signal(true);

  toggleExpanded(): void {
    this.expanded.update((current) => !current);
  }
}
