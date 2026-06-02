import { Component, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';

import { OutboundRecord } from '../../core/models';

@Component({
  selector: 'outbound-table',
  templateUrl: 'order-table.html',
  imports: [DatePipe],
})
export class OutboundTable {
  readonly records = input<OutboundRecord[]>([]);
  readonly removeBatch = output<string>();
  readonly confirmImportedAt = signal<string | null>(null);

  requestRemove(importedAt: string): void {
    this.confirmImportedAt.set(importedAt);
  }

  cancelRemove(): void {
    this.confirmImportedAt.set(null);
  }

  confirmRemove(importedAt: string): void {
    this.confirmImportedAt.set(null);
    this.removeBatch.emit(importedAt);
  }
}
