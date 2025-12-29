import { Component, computed, signal, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { api } from '@convex/_generated/api';
import { ConvexService } from '../../core/services/convex.service';
import { toSignal } from '@angular/core/rxjs-interop';
import { Observable } from 'rxjs';

// ✅ Interfaces
export interface AttendanceRecord {
  _id: string;
  checkInTime?: number;
  checkOutTime?: number;
  date: string;
  status?: string;
}

export interface AttendanceSummary {
  presentDays: number;
  totalHours: number;
}

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './attendance.component.html'
})
export class AttendanceComponent {
  private convex = inject(ConvexService);
  private platformId = inject(PLATFORM_ID);

  activeTab = signal<'today' | 'history' | 'summary'>('today');
  currentTime = signal(new Date());
  isProcessing = signal(false);

  // ✅ Nullable for loading state
  todayAttendance = toSignal<AttendanceRecord | null>(
    this.convex.watch(api.attendance.queries.getTodayAttendance),
    { initialValue: null }
  );

  // ✅ Array type (non-nullable)
history = toSignal(
  this.convex.watch(api.attendance.queries.getHistory) as Observable<AttendanceRecord[]>,
  { initialValue: [] as AttendanceRecord[] }
);

  // ✅ Nullable for loading state
  summary = toSignal<AttendanceSummary | null>(
    this.convex.watch(api.attendance.queries.getStats),
    { initialValue: null }
  );

  workingHours = computed(() => {
    const data = this.todayAttendance();
    if (!data?.checkInTime) return '0.0';
    
    if (data.checkOutTime) {
      const diff = data.checkOutTime - data.checkInTime;
      return (diff / (1000 * 60 * 60)).toFixed(1);
    }
    
    const diff = this.currentTime().getTime() - data.checkInTime;
    return (diff / (1000 * 60 * 60)).toFixed(1);
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      setInterval(() => this.currentTime.set(new Date()), 1000);
    }
  }

  async handleCheckIn() {
    if (this.isProcessing()) return;
    this.isProcessing.set(true);
    
    try {
      const position = await this.getCurrentLocation();
      await this.convex.mutation(api.attendance.mutation.checkIn, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        address: "Current Location"
      });
    } catch (error) {
      console.error("Check-in failed", error);
      alert("Could not check in. Please ensure GPS is enabled.");
    } finally {
      this.isProcessing.set(false);
    }
  }

  async handleCheckOut() {
    if (this.isProcessing()) return;
    this.isProcessing.set(true);
    
    try {
      const position = await this.getCurrentLocation();
      await this.convex.mutation(api.attendance.mutation.checkOut, {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        address: "Current Location"
      });
    } catch (error) {
      console.error("Check-out failed", error);
      alert("Could not check out. Please ensure GPS is enabled.");
    } finally {
      this.isProcessing.set(false);
    }
  }

  getCurrentLocation(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!isPlatformBrowser(this.platformId) || !navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      });
    });
  }

  getStatusColor(status: string | undefined): string {
    if (!status) return 'bg-gray-100 text-gray-800';
    const colors: Record<string, string> = {
      present: 'bg-green-100 text-green-800',
      absent: 'bg-red-100 text-red-800',
      half_day: 'bg-yellow-100 text-yellow-800',
      leave: 'bg-blue-100 text-blue-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }
}