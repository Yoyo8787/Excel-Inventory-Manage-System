import { Component, inject } from '@angular/core';

import { LayoutService } from '../../core/services/layout.service';
import { MenuItem } from './menu';

@Component({
  selector: 'app-sidenav',
  imports: [],
  templateUrl: './sidenav.html',
})
export class Sidenav {
  readonly layoutService = inject(LayoutService);
  readonly menuItems = MenuItem;
}
