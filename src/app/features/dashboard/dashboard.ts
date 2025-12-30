import { Component, OnInit, OnDestroy, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth/services/auth.service';
import { ConvexService } from '../../core/services/convex.service';
import { api } from '@convex/_generated/api';
import { TargetsWidgetComponent } from './targets-widget/targets-widget.component';

interface TaskStats {
  pending: number;
  total: number;
  inProgress: number;
  completed: number;
  overdue: number;
}

interface AttendanceSummary {
  presentDays: number;
  totalHours: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule,TargetsWidgetComponent],
  templateUrl: './dashboard.html'
})
export class DashboardComponent implements OnInit, OnDestroy {
  // Injections
  private router = inject(Router);
  private authService = inject(AuthService);
  private convex = inject(ConvexService);

  // Signals (Reactive State)
  tasksSummary = signal<TaskStats | null>(null);
  attendanceSummary = signal<AttendanceSummary | null>(null);
  todayAttendance = signal<any>(null);
  currentLocation = signal<any>(null);
  isLoading = signal(true);
  isAuthenticated = this.authService.isAuthenticated;
  currentUser = this.authService.currentUser;

  // Clock State
  currentTime = signal(new Date());
  private timerInterval: any;

  constructor() {
    // Auto-reload data when auth changes
    effect(() => {
      if (this.isAuthenticated()) {
        this.loadData();
      }
    });
  }

  ngOnInit() {
    this.startClock();
    
    // Wait for auth before loading data
    if (this.authService.isLoading()) {
      // Wait for auth to complete
      setTimeout(() => this.loadData(), 500);
    } else {
      this.loadData();
    }
  }

  ngOnDestroy() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  private startClock() {
    this.timerInterval = setInterval(() => {
      this.currentTime.set(new Date());
    }, 1000);
  }

  async loadData() {
    if (!this.authService.isAuthenticated()) {
      console.log('🚫 Dashboard: Not authenticated, skipping data load');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    try {
      console.log('📊 Dashboard: Loading data...');
      
      // Fetch all data in parallel
      const [tasks, attendanceSum, todayAtt] = await Promise.all([
        this.convex.query<TaskStats>(api.tasks.me.queries.getMyTaskStats),
        this.convex.query<AttendanceSummary>(api.attendance.queries.getStats),
        this.convex.query<any>(api.attendance.queries.getTodayAttendance)
      ]);

      this.tasksSummary.set(tasks);
      this.attendanceSummary.set(attendanceSum);
      this.todayAttendance.set(todayAtt);
      
      console.log('✅ Dashboard data loaded:', { tasks, attendanceSum, todayAtt });
    } catch (error: any) {
      console.error('Failed to load dashboard data:', error);
      
      // Handle auth errors specifically
      if (error.message?.includes('Not authenticated')) {
        console.log('🔐 Dashboard: Auth required, redirecting to login');
        this.router.navigate(['/login']);
        return;
      }
      
      // Set empty states on error
      this.tasksSummary.set(null);
      this.attendanceSummary.set(null);
      this.todayAttendance.set(null);
    } finally {
      this.isLoading.set(false);
    }
  }

  // Computed Helpers
  get isCheckedIn() {
    return !!this.todayAttendance()?.checkInTime;
  }

  calculateHoursWorked(): string {
    const attendance = this.todayAttendance();
    if (!attendance?.checkInTime) return '0.0';
    
    if (attendance.checkOutTime) {
      const hours = (attendance.checkOutTime - attendance.checkInTime) / (1000 * 60 * 60);
      return hours.toFixed(1);
    }
    
    const hours = (Date.now() - attendance.checkInTime) / (1000 * 60 * 60);
    return Math.min(hours, 24).toFixed(1);
  }

  // Actions
  handleCheckInOut() {
    this.router.navigate(['/attendance']);
  }

  handleEmergency() {
    console.log('🚨 Emergency triggered');
    // TODO: Implement emergency logic
  }

  refreshData() {
    this.loadData();
  }
}
