import { Component, input } from '@angular/core';

@Component({
  selector: 'inbound-summary-card',
  imports: [],
  templateUrl: './inbound-summary-card.html',
})
export class InboundSummaryCard {
  readonly inboundCount = input.required<number>();
  readonly totalQty = input.required<number>();
}
