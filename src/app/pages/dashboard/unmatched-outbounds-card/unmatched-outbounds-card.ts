import { Component, input, output } from '@angular/core';

import type { UnmatchedOutbound } from '../../../core/models';

@Component({
  selector: 'unmatched-outbounds-card',
  imports: [],
  templateUrl: './unmatched-outbounds-card.html',
})
export class UnmatchedOutboundsCard {
  readonly outbounds = input.required<UnmatchedOutbound[]>();

  readonly gotoRequested = output<void>();
}
