import { Component, input } from '@angular/core';
import { MatTableModule } from '@angular/material/table';
import { DatePipe } from '@angular/common';

import { Order } from '../../core/models';
@Component({
  selector: 'order-table',
  templateUrl: 'order-table.html',
  imports: [MatTableModule, DatePipe],
})
export class OrderTable {
  readonly orders = input<Order[]>([]);
  displayedColumns: string[] = ['platform', 'orderNo', 'importedAt', 'productName', 'amountTotal'];
}
