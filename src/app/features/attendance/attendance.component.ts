import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ConvexService } from '../../core/services/convex.service';
import { api } from '@convex/_generated/api';

@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './attendance.component.html',
  styleUrls: ['./attendance.component.scss']
})
export class AttendanceComponent implements OnInit {
  // ✅ Expose Date for template
  Date = Date;
  
  // ✅ Changed from private to public for template access
  rawAttendance = signal<any>(null);
  
  isProcessing = signal(false);
  error = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  currentLocation = signal<{ latitude: number; longitude: number; address: string } | null>(null);

  // ✅ CRITICAL FIX: Validate attendance date matches TODAY
  todayAttendanceValidated = computed(() => {
    const attendance = this.rawAttendance();
    if (!attendance) return null;

    // Get today's date string (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];
    
    // Get attendance date string
    const attendanceDate = attendance.date;
    
    console.log('📅 Date Check:', { 
      today, 
      attendanceDate, 
      matches: attendanceDate === today 
    });

    // ✅ ONLY return attendance if date matches today
    if (attendanceDate !== today) {
      console.log('⚠️ Attendance date does not match today - treating as not checked in');
      return null;
    }

    return attendance;
  });

  // Computed properties based on validated attendance
  isCheckedIn = computed(() => {
    const attendance = this.todayAttendanceValidated();
    return !!attendance?.checkInTime;
  });

  isCheckedOut = computed(() => {
    const attendance = this.todayAttendanceValidated();
    return !!attendance?.checkOutTime;
  });

  workingHours = computed(() => {
    const attendance = this.todayAttendanceValidated();
    if (!attendance?.checkInTime) return 0;

    const endTime = attendance.checkOutTime || Date.now();
    const hours = (endTime - attendance.checkInTime) / (1000 * 60 * 60);
    return Math.max(0, Math.min(hours, 24)); // Cap at 24 hours
  });

  constructor(
    private convex: ConvexService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadTodayAttendance();
    this.getCurrentLocation();
  }

  async loadTodayAttendance() {
    try {
      console.log('🔄 Loading today\'s attendance...');
      
      const data = await this.convex.client.query(
        api.attendance.queries.getTodayAttendance,
        {}
      );

      console.log('📊 Backend returned:', data);
      
      // Store raw data
      this.rawAttendance.set(data);

      // Log validation result
      const validated = this.todayAttendanceValidated();
      console.log('✅ Validated attendance:', validated);
      console.log('✅ Is Checked In:', this.isCheckedIn());

    } catch (err: any) {
      console.error('❌ Failed to load attendance:', err);
      this.error.set(err?.message || 'Failed to load attendance');
    }
  }

  getCurrentLocation() {
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.currentLocation.set({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          address: `${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)}`
        });
      },
      (error) => {
        console.error('Location error:', error);
      }
    );
  }

  async checkIn() {
    if (this.isProcessing()) return;
    if (this.isCheckedIn()) {
      this.error.set('Already checked in today');
      return;
    }

    const location = this.currentLocation();
    if (!location) {
      this.error.set('Location required for check-in');
      return;
    }

    try {
      this.isProcessing.set(true);
      this.error.set(null);

      console.log('📍 Checking in with location:', location);

      await this.convex.client.mutation(
        api.attendance.mutations.checkIn,
        { location }
      );

      this.successMessage.set('✅ Checked in successfully!');
      
      // Reload attendance data
      await this.loadTodayAttendance();

      // Clear success message after 3 seconds
      setTimeout(() => this.successMessage.set(null), 3000);

    } catch (err: any) {
      console.error('❌ Check-in failed:', err);
      this.error.set(err?.message || 'Check-in failed');
    } finally {
      this.isProcessing.set(false);
    }
  }

  async checkOut() {
    if (this.isProcessing()) return;
    if (!this.isCheckedIn()) {
      this.error.set('Must check in first');
      return;
    }
    if (this.isCheckedOut()) {
      this.error.set('Already checked out today');
      return;
    }

    const location = this.currentLocation();
    if (!location) {
      this.error.set('Location required for check-out');
      return;
    }

    try {
      this.isProcessing.set(true);
      this.error.set(null);

      console.log('🚪 Checking out with location:', location);

      await this.convex.client.mutation(
        api.attendance.mutations.checkOut,
        { location }
      );

      this.successMessage.set('✅ Checked out successfully!');
      
      // Reload attendance data
      await this.loadTodayAttendance();

      // Clear success message after 3 seconds
      setTimeout(() => this.successMessage.set(null), 3000);

    } catch (err: any) {
      console.error('❌ Check-out failed:', err);
      this.error.set(err?.message || 'Check-out failed');
    } finally {
      this.isProcessing.set(false);
    }
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  formatTime(timestamp: number | undefined): string {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}