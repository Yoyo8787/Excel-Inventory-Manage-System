import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  readonly sidenavOpened = signal(true);
  toggleSidenav(): void {
    this.sidenavOpened.update((opened) => !opened);
  }

  readonly page = signal('dashboard');
  setPage(page: string): void {
    this.page.set(page);
  }
}
