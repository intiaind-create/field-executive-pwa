// executive-pwa/src/app/features/dashboard/targets-widget/targets-widget.component.ts

import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { api } from 'convex/_generated/api';
import { ConvexService } from '../../../core/services/convex.service';

interface TargetProgress {
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  sponsorshipTarget: number;
  sponsorshipAchieved: number;
  sponsorshipProgress: number;
  tasksTarget: number;
  tasksCompleted: number;
  tasksProgress: number;
  votersTarget: number;
  votersContacted: number;
  votersProgress: number;
  overallProgress: number;
  daysRemaining: number;
  isOnTrack: boolean;
}

interface DashboardData {
  daily: TargetProgress | null;
  weekly: TargetProgress | null;
  monthly: TargetProgress | null;
  quarterly: TargetProgress | null;
  totalSponsorshipTarget: number;
  totalSponsorshipAchieved: number;
  totalTasksTarget: number;
  totalTasksCompleted: number;
  totalVotersTarget: number;
  totalVotersContacted: number;
  overallSponsorshipProgress: number;
  overallTasksProgress: number;
  overallVotersProgress: number;
}

@Component({
  selector: 'app-targets-widget',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './targets-widget.component.html',
  styleUrls: ['./targets-widget.component.scss']
})
export class TargetsWidgetComponent implements OnInit {
  dashboard = signal<DashboardData | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  constructor(
    private convex: ConvexService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadDashboard();
  }

  async loadDashboard() {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      const data = await this.convex.client.query(
        api.targets.me.queries.getMyTargetDashboard,
        {}
      );

      this.dashboard.set(data);
    } catch (err: any) {
      console.error('Failed to load targets:', err);
      this.error.set(err?.message || 'Failed to load targets');
    } finally {
      this.isLoading.set(false);
    }
  }

  getProgressColor(progress: number): string {
    if (progress >= 80) return '#10b981'; // Green
    if (progress >= 50) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  }

  viewDetails() {
    this.router.navigate(['/targets']);
  }
}