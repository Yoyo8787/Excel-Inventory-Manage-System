import { Component, inject, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MatChipsModule } from '@angular/material/chips';
import { MatToolbarModule } from '@angular/material/toolbar';

import { LayoutService } from '../../core/services/layout.service';

@Component({
  selector: 'app-toolbar',
  imports: [CommonModule, MatChipsModule, MatToolbarModule, MatIconModule],
  templateUrl: './toolbar.html',
})
export class Toolbar {
  readonly isDirty = input(false);
  readonly lastSavedAt = input<string | null>(null);
  readonly layoutService = inject(LayoutService);
}
