import { Component, inject, OnDestroy, OnInit, signal, PLATFORM_ID, effect } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd, ActivatedRoute } from '@angular/router';
import { LocationTrackerService } from './core/services/location/location-tracker.service';
import { OfflineSyncService } from './core/services/offline-sync.service';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { BottomNavComponent } from './core/layout/bottom-nav/bottom-nav.component';
import { filter, map } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, BottomNavComponent, CommonModule],
  templateUrl: './app.html', // ✅ Use external template
  styleUrls: ['./app.scss'] // ✅ Add if you have styles
})
export class App implements OnInit, OnDestroy {
  private locationTracker = inject(LocationTrackerService);
  private offlineSync = inject(OfflineSyncService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  private platformId = inject(PLATFORM_ID);
  
  // State
  isOnline = signal(true);
  showBottomNav = signal(true);
  pendingActions = signal(0);

  constructor() {
    // ✅ Auto-sync when connection is restored
    effect(() => {
      if (this.isOnline() && isPlatformBrowser(this.platformId)) {
        console.log('🌐 Online - triggering sync');
        this.offlineSync.syncPendingActions();
      }
    });

    // ✅ Update pending actions count
    if (isPlatformBrowser(this.platformId)) {
      effect(() => {
        this.pendingActions.set(this.offlineSync.offlineStorage.pendingActionsCount());
      });
    }
  }

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      // Start location tracking
      this.locationTracker.startTracking();
      
      // Setup online/offline listeners
      window.addEventListener('online', this.updateOnlineStatus);
      window.addEventListener('offline', this.updateOnlineStatus);
      
      // Set initial online status from browser
      this.isOnline.set(navigator.onLine);

      // ✅ Watch route data to show/hide bottom nav
      this.router.events
        .pipe(
          filter(event => event instanceof NavigationEnd),
          map(() => {
            let route = this.activatedRoute;
            while (route.firstChild) route = route.firstChild;
            return route;
          }),
          map(route => route.snapshot.data)
        )
        .subscribe(data => {
          // Hide nav if route has hideNav: true, otherwise show
          this.showBottomNav.set(!data['hideNav']);
        });

      // ✅ Set initial bottom nav state from current route
      let route = this.activatedRoute;
      while (route.firstChild) route = route.firstChild;
      const hideNav = route.snapshot.data['hideNav'];
      this.showBottomNav.set(!hideNav);

      // ✅ Trigger initial sync if online
      if (navigator.onLine) {
        this.offlineSync.syncPendingActions();
      }
    }
  }

  ngOnDestroy() {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('online', this.updateOnlineStatus);
      window.removeEventListener('offline', this.updateOnlineStatus);
    }
  }

  private updateOnlineStatus = () => {
    if (isPlatformBrowser(this.platformId)) {
      this.isOnline.set(navigator.onLine);
      console.log('🔌 Network status:', navigator.onLine ? 'Online' : 'Offline');
    }
  }
}