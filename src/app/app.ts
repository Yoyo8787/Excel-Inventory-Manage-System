import { Component, HostListener, effect, inject } from '@angular/core';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

import { StoreService } from './core/services/store.service';
import { LayoutService } from './core/services/layout.service';

import { Toolbar } from './components/toolbar/toolbar';
import { Sidenav } from './components/sidenav/sidenav';

import { InitPage } from './pages/init/init.page';
import { DashboardPage } from './pages/dashboard/dashboard.page';
import { OrdersPage } from './pages/orders/orders.page';
import { ManualOrderPage } from './pages/manual-order/manual-order.page';
import { ProductsPage } from './pages/products/products.page';
import { ImportPage } from './pages/import/import.page';
import { SettingsPage } from './pages/settings/settings.page';

@Component({
  selector: 'app-root',
  imports: [
    MatDialogModule,
    Toolbar,
    Sidenav,
    DashboardPage,
    OrdersPage,
    ManualOrderPage,
    ProductsPage,
    ImportPage,
    SettingsPage,
  ],
  templateUrl: './app.html',
})
export class App {
  readonly #storeService = inject(StoreService);
  readonly #layoutService = inject(LayoutService);
  readonly #dialog = inject(MatDialog);

  readonly state = this.#storeService.state;
  readonly page = this.#layoutService.page;
  readonly isLoaded = this.#storeService.isLoaded;
  readonly sidenavOpened = this.#layoutService.sidenavOpened;

  private initDialogRef: MatDialogRef<InitPage> | null = null;

  gotoPage(p: string): void {
    this.#layoutService.setPage(p);
  }

  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    if (!this.state().dirty.isDirty) {
      return;
    }

    if (window.confirm('有未儲存的變更，確定要離開嗎？')) {
      return;
    }
    event.preventDefault();
    event.returnValue = '';
  }

  constructor() {
    effect(() => {
      if (this.isLoaded()) {
        this.initDialogRef?.close();
        this.initDialogRef = null;
        return;
      }

      if (this.initDialogRef) return;

      this.initDialogRef = this.#dialog.open(InitPage, {
        disableClose: true,
        width: '560px',
        maxWidth: 'calc(100vw - 32px)',
        panelClass: 'ledger-dialog',
      });

      this.initDialogRef.afterClosed().subscribe(() => {
        this.initDialogRef = null;
      });
    });
  }
}
