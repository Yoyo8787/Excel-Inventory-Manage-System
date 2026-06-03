import { Component, input, output, signal } from '@angular/core';

import type { InboundBatchSection as InboundBatchSectionData } from '../import.types';

@Component({
  selector: 'inbound-batch-section',
  imports: [],
  templateUrl: './inbound-batch-section.html',
})
export class InboundBatchSection {
  readonly section = input.required<InboundBatchSectionData>();
  readonly confirmImportedAt = input<string | null>(null);

  readonly removeRequested = output<string>();
  readonly removeCanceled = output<void>();
  readonly removeConfirmed = output<string>();

  readonly expanded = signal(true);

  toggleExpanded(): void {
    this.expanded.update((current) => !current);
  }
}
