import { Component, effect, inject } from '@angular/core';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { StoreService } from './core/services/store.service';
import { LayoutService } from './core/services/layout.service';

import { Toolbar } from './components/toolbar/toolbar';
import { Sidenav } from './components/sidenav/sidenav';

import { InitPage } from './pages/init/init.page';
import { DashboardPage } from './pages/dashboard/dashboard.page';
import { OrdersPage } from './pages/orders/orders.page';

@Component({
  selector: 'app-root',
  imports: [MatDialogModule, Toolbar, Sidenav, DashboardPage, OrdersPage],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly #storeService = inject(StoreService);
  readonly #layoutService = inject(LayoutService);
  readonly #dialog = inject(MatDialog);

  readonly state = this.#storeService.state;
  readonly page = this.#layoutService.page;
  readonly isLoaded = this.#storeService.isLoaded;
  private initDialogRef: MatDialogRef<InitPage> | null = null;

  constructor() {
    effect(() => {
      if (this.isLoaded()) {
        this.initDialogRef?.close();
        this.initDialogRef = null;
        return;
      }

      if (this.initDialogRef) {
        return;
      }

      this.initDialogRef = this.#dialog.open(InitPage, {
        disableClose: true,
        width: '420px',
        maxWidth: 'calc(100vw - 32px)',
      });

      this.initDialogRef.afterClosed().subscribe(() => {
        this.initDialogRef = null;
      });
    });
  }
}
