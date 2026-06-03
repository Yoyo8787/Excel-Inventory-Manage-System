import { Component, input } from '@angular/core';

import type { OutboundImportSummary } from '../orders.types';

@Component({
  selector: 'outbound-result-card',
  imports: [],
  templateUrl: './outbound-result-card.html',
})
export class OutboundResultCard {
  readonly summary = input.required<OutboundImportSummary>();
}
