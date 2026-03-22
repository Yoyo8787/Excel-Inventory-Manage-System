import { Injectable, signal, inject } from '@angular/core';

import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  readonly sidenavOpened = signal(true);
  private snackBar = inject(MatSnackBar);
  toggleSidenav(): void {
    this.sidenavOpened.update((opened) => !opened);
  }

  readonly page = signal('dashboard');
  setPage(page: string): void {
    this.page.set(page);
  }

  showMessage(message: string): void {
    this.snackBar.open(message, 'Close', { duration: 3000 });
  }
  showError(message: string): void {
    this.snackBar.open(message, 'Close', { duration: 5000, panelClass: ['bg-error-container'] });
  }
}
