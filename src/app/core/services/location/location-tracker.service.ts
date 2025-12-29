import { effect, inject, Injectable, OnDestroy, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { api } from '@convex/_generated/api';
import { ConvexService } from '../convex.service';
import { OfflineSyncService } from '../offline-sync.service';

@Injectable({
  providedIn: 'root'
})
export class LocationTrackerService implements OnDestroy {
  private convex = inject(ConvexService);
  private offlineSync = inject(OfflineSyncService);
  private platformId = inject(PLATFORM_ID);
  
  // Public State
  isTracking = signal(false);
  lastUpdate = signal<Date | null>(null);
  currentCoords = signal<{lat: number, lng: number} | null>(null);
  lastError = signal<string | null>(null);

  // Internal State
  private intervalId: any = null;
  private watchId: number | null = null;
  private lastCoords: {lat: number, lng: number} | null = null;
  private readonly UPDATE_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly MOVEMENT_THRESHOLD = 0.0001; // ~10 meters

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.setupVisibilityListener();
    }
  }

  ngOnDestroy() {
    this.stopTracking();
  }

  startTracking() {
    if (!isPlatformBrowser(this.platformId)) {
      console.log('📍 Location tracking skipped - server environment');
      return;
    }

    if (!navigator.geolocation) {
      console.warn("❌ Geolocation not supported");
      this.lastError.set("Geolocation not supported");
      return;
    }

    if (this.isTracking()) return;

    console.log('📍 Starting location tracking...');

    // 1. Immediate capture
    this.captureLocation();

    // 2. Periodic capture (every 5 minutes)
    this.intervalId = setInterval(() => {
      this.captureLocation();
    }, this.UPDATE_INTERVAL);

    this.isTracking.set(true);
  }

  stopTracking() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.watchId !== null && isPlatformBrowser(this.platformId)) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    
    this.isTracking.set(false);
    console.log('📍 Location tracking stopped');
  }

  private async captureLocation() {
    if (!isPlatformBrowser(this.platformId) || !navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

          // ✅ Detect movement
          const isMoving = this.hasMovedSignificantly(coords);

          // Update local state
          this.currentCoords.set(coords);
          this.lastUpdate.set(new Date());
          this.lastError.set(null);
          this.lastCoords = coords;

          // ✅ Get battery level (if available)
          let batteryLevel: number | undefined;
          if ('getBattery' in navigator) {
            try {
              const battery: any = await (navigator as any).getBattery();
              batteryLevel = Math.round(battery.level * 100);
            } catch (e) {
              // Battery API not available
            }
          }

          // ✅ Send to backend (with offline support)
          if (this.offlineSync.isOnline()) {
            await this.convex.mutation(api.location.mutation.track, {
              latitude: coords.lat,
              longitude: coords.lng,
              accuracy: position.coords.accuracy,
              isMoving,
              batteryLevel,
            });
            console.log('✅ Location synced:', coords);
          } else {
            // ✅ Queue for offline sync
            this.offlineSync.queueAction('trackLocation', {
              latitude: coords.lat,
              longitude: coords.lng,
              accuracy: position.coords.accuracy,
              isMoving,
              batteryLevel,
            });
            console.log('📥 Location queued for offline sync');
          }
          
        } catch (error: any) {
          console.error("❌ Failed to sync location:", error);
          this.lastError.set(error.message);
        }
      },
      (error) => {
        const errorMsg = `Geolocation error: ${error.message}`;
        console.error(errorMsg);
        this.lastError.set(errorMsg);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000, 
        maximumAge: 60000 
      }
    );
  }

  // ✅ Detect if executive has moved significantly
  private hasMovedSignificantly(newCoords: {lat: number, lng: number}): boolean {
    if (!this.lastCoords) return true;

    const latDiff = Math.abs(newCoords.lat - this.lastCoords.lat);
    const lngDiff = Math.abs(newCoords.lng - this.lastCoords.lng);

    // If moved more than threshold (~10 meters)
    return latDiff > this.MOVEMENT_THRESHOLD || lngDiff > this.MOVEMENT_THRESHOLD;
  }

  private setupVisibilityListener() {
    if (!isPlatformBrowser(this.platformId) || typeof document === 'undefined') {
      return;
    }

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        // Ensure tracking when app becomes visible
        if (!this.isTracking()) {
          this.startTracking();
        } else {
          // Immediate capture when returning to app
          this.captureLocation();
        }
      }
    });
  }

  // ✅ Public method to force location update
  async forceUpdate() {
    await this.captureLocation();
  }
}