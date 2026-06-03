import { Component, input } from '@angular/core';

import type { DashboardStat } from '../dashboard.types';

@Component({
  selector: 'dashboard-stat-card',
  imports: [],
  templateUrl: './dashboard-stat-card.html',
})
export class DashboardStatCard {
  readonly stat = input.required<DashboardStat>();
}
