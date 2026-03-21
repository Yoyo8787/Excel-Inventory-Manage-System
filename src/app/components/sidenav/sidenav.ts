import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, signal } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';

import { LayoutService } from '../../core/services/layout.service';

import { MenuItem } from './menu';

@Component({
  selector: 'app-sidenav',
  imports: [CommonModule, MatSidenavModule, MatIconModule],
  templateUrl: './sidenav.html',
})
export class Sidenav {
  readonly layoutService = inject(LayoutService);
  readonly menuItems = MenuItem;
}
