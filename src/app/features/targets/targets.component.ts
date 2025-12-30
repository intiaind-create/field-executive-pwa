// executive-pwa/src/app/features/targets/targets.component.ts

import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { ConvexService } from '../../core/services/convex.service';
import { api } from '@convex/_generated/api';

interface TargetWithProgress {
  _id: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  startDate: number;
  endDate: number;
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
  status: 'active' | 'completed' | 'failed' | 'cancelled';
}

@Component({
  selector: 'app-targets',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './targets.component.html',
  styleUrls: ['./targets.component.scss']
})
export class TargetsComponent implements OnInit {
  targets = signal<TargetWithProgress[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  selectedFilter = signal<'active' | 'all'>('active');

  constructor(
    private convex: ConvexService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadTargets();
  }

  async loadTargets() {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      const status = this.selectedFilter() === 'active' ? 'active' : undefined;
      
      const data = await this.convex.client.query(
        api.targets.me.queries.getMyTargets,
        { status, limit: 20 }
      );

      this.targets.set(data);
    } catch (err: any) {
      console.error('Failed to load targets:', err);
      this.error.set(err?.message || 'Failed to load targets');
    } finally {
      this.isLoading.set(false);
    }
  }

  filterTargets(filter: 'active' | 'all') {
    this.selectedFilter.set(filter);
    this.loadTargets();
  }

  getProgressColor(progress: number): string {
    if (progress >= 80) return '#10b981'; // Green
    if (progress >= 50) return '#f59e0b'; // Orange
    return '#ef4444'; // Red
  }

  getPeriodColor(period: string): string {
    const colors: Record<string, string> = {
      daily: '#fbbf24',
      weekly: '#3b82f6',
      monthly: '#10b981',
      quarterly: '#8b5cf6'
    };
    return colors[period] || '#6b7280';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatDateRange(startDate: number, endDate: number): string {
    const start = new Date(startDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short'
    });
    const end = new Date(endDate).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
    return `${start} - ${end}`;
  }

  goBack() {
    this.router.navigate(['/dashboard']);
  }

  refresh() {
    this.loadTargets();
  }
}