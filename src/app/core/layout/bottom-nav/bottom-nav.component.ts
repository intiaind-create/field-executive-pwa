import { Component, inject, signal, OnInit, HostListener, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { ConvexService } from '../../services/convex.service';
import { AuthService } from '../../auth/services/auth.service';
import { OfflineStorageService } from '../../services/offline-storage.service';
import { api } from '@convex/_generated/api';
import { filter, takeUntil } from 'rxjs/operators';
import { Subject } from 'rxjs';

const ROUTE_MAP: Record<string, string[]> = {
  'dashboard': ['/dashboard', '/'],
  'tasks': ['/tasks'],
  'attendance': ['/attendance'],
  'training': ['/training'],
  'targets': ['/targets'],  // ← NEW
  'settings': ['/settings', '/store', '/profile']
};

@Component({
  selector: 'app-bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './bottom-nav.component.html',
})
export class BottomNavComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private convex = inject(ConvexService);
  private authService = inject(AuthService);
  private offlineStorage = inject(OfflineStorageService);
  private destroy$ = new Subject<void>();

  // State signals
  pendingTasks = signal(0);
  activeRoute = signal('dashboard');
  pendingOfflineActions = this.offlineStorage.pendingActionsCount;
  showMoreMenu = signal(false);

  ngOnInit() {
    // ✅ Single subscription with cleanup
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(event => {
        this.updateActiveRoute(event.urlAfterRedirects);
        this.showMoreMenu.set(false);
      });

    // ✅ Initial route and task load
    this.updateActiveRoute(this.router.url);
    this.loadPendingTasksCount();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.more-menu-container')) {
      this.showMoreMenu.set(false);
    }
  }

  // ✅ Optimized route matching
  private updateActiveRoute(url: string) {
    const route = Object.entries(ROUTE_MAP).find(([_, patterns]) =>
      patterns.some(pattern => url.startsWith(pattern))
    );
    
    this.activeRoute.set(route ? route[0] : 'dashboard');
  }

  // ✅ Only load when authenticated
  private async loadPendingTasksCount() {
    if (!this.authService.isAuthenticated()) return;

    try {
      const stats = await this.convex.query<any>(
        api.tasks.me.queries.getMyTaskStats,
        {}
      );
      
      this.pendingTasks.set((stats?.pending || 0) + (stats?.inProgress || 0));
    } catch (error) {
      console.error('Failed to load task count:', error);
      this.pendingTasks.set(0); // ✅ Reset on error
    }
  }

  isActive(route: string): boolean {
    return this.activeRoute() === route;
  }

  toggleMoreMenu(event: Event) {
    event.stopPropagation();
    this.showMoreMenu.update(show => !show); // ✅ Use update
  }

  navigateAndClose(route: string) {
    this.showMoreMenu.set(false);
    this.router.navigate([route]);
  }

  // ✅ Public refresh method
  refreshTaskCount() {
    this.loadPendingTasksCount();
  }
}