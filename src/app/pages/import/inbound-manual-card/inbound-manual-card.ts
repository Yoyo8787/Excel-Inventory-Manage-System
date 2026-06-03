import { Component, input, output } from '@angular/core';

import type { InboundLine, InboundLineKey } from '../import.types';

export interface InboundLineUpdate {
  index: number;
  key: InboundLineKey;
  value: string | number;
}

@Component({
  selector: 'inbound-manual-card',
  imports: [],
  templateUrl: './inbound-manual-card.html',
})
export class InboundManualCard {
  readonly lines = input.required<InboundLine[]>();
  readonly productNameOptions = input.required<string[]>();
  readonly productStyleOptions = input.required<string[]>();
  readonly activeLineCount = input.required<number>();
  readonly totalQty = input.required<number>();

  readonly lineUpdated = output<InboundLineUpdate>();
  readonly lineAdded = output<void>();
  readonly lineRemoved = output<number>();
  readonly submitted = output<void>();
}
