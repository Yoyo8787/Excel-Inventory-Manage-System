import { Component, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';

import { Order } from '../../core/models';

@Component({
  selector: 'order-table',
  templateUrl: 'order-table.html',
  imports: [DatePipe, DecimalPipe],
})
export class OrderTable {
  readonly orders = input<Order[]>([]);
  readonly deleteOrder = output<Order>();
  readonly confirmDeleteOrderId = signal<string | null>(null);

  requestDelete(order: Order): void {
    this.confirmDeleteOrderId.set(order.id);
  }

  cancelDelete(): void {
    this.confirmDeleteOrderId.set(null);
  }

  confirmDelete(order: Order): void {
    this.confirmDeleteOrderId.set(null);
    this.deleteOrder.emit(order);
  }
}
