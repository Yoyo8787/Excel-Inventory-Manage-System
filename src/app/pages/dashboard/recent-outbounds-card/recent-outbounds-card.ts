import { Component, input, output } from '@angular/core';

import type { OutboundRecord } from '../../../core/models';

@Component({
  selector: 'recent-outbounds-card',
  imports: [],
  templateUrl: './recent-outbounds-card.html',
})
export class RecentOutboundsCard {
  readonly outbounds = input.required<OutboundRecord[]>();

  readonly gotoRequested = output<void>();

  formatImportedAt(iso: string): string {
    return iso.replace('T', ' ').slice(0, 16);
  }
}
