import { Component, input } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';

import { Order } from '../../core/models';

@Component({
  selector: 'order-table',
  templateUrl: 'order-table.html',
  imports: [DatePipe, DecimalPipe],
})
export class OrderTable {
  readonly orders = input<Order[]>([]);
}
