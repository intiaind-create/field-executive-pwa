import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { BadgeModule } from 'primeng/badge';
import { TableModule } from 'primeng/table';
import { SkeletonModule } from 'primeng/skeleton';
import { DividerModule } from 'primeng/divider';
import { ButtonModule } from 'primeng/button';
import { ConvexService } from '@/core/services/convex.service';
import { Id } from '@convex/_generated/dataModel';
import { api } from '@convex/_generated/api';

interface CourseProgress {
  courseId: Id<"training_courses">;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  estimatedHours: number;
  totalModules: number;
  passingScore: number;
  progress: {
    progressId: Id<"training_progress">;
    completedModules: number;
    progressPercentage: number;
    status: "not_started" | "in_progress" | "completed" | "failed";
    startedAt: number;
    lastAccessedAt: number;
    completedAt?: number;
    finalScore?: number;
    certificateId?: Id<"_storage">;
  } | null;
}

interface Statistics {
  courses: {
    total: number;
    completed: number;
    inProgress: number;
    completionRate: number;
  };
  modules: {
    totalCompleted: number;
  };
  quizzes: {
    total: number;
    passed: number;
    passRate: number;
    avgScore: number;
  };
  avgCourseScore: number;
}

@Component({
  selector: 'app-progress',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    CardModule, 
    ProgressBarModule, 
    BadgeModule, 
    TableModule, 
    SkeletonModule, 
    DividerModule,
    ButtonModule
  ],
  templateUrl: './progress.component.html',
  styleUrls: ['./progress.component.scss']
})
export class ProgressComponent implements OnInit {
  private convexService = inject(ConvexService);

  // ✅ Signals for state
courses = signal<(CourseProgress | null)[]>([]);
  statistics = signal<Statistics | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);

  // ✅ Computed state
hasCourses = computed(() => this.courses().filter(c => c !== null).length > 0);
  ngOnInit() {
    this.loadData();
  }

  private async loadData() {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      // ✅ Load both courses and statistics in parallel
      const [coursesData, statsData] = await Promise.all([
        this.convexService.client.query(
          api.training.executive.progress.getMyCourses,
          {}
        ),
        this.convexService.client.query(
          api.training.executive.progress.getMyStatistics,
          {}
        )
      ]);

this.courses.set(coursesData.filter((c:any) => c !== null));
      this.statistics.set(statsData);
    } catch (err: any) {
      console.error('❌ Failed to load progress:', err);
      this.error.set(err.message || 'Failed to load progress data');
    } finally {
      this.isLoading.set(false);
    }
  }

  // ✅ Statistics getters
  getStatsTotalCourses(): number {
    return this.statistics()?.courses?.total ?? 0;
  }

  getStatsCompletedCourses(): number {
    return this.statistics()?.courses?.completed ?? 0;
  }

  getStatsInProgressCourses(): number {
    return this.statistics()?.courses?.inProgress ?? 0;
  }

  getStatsQuizzesTotal(): number {
    return this.statistics()?.quizzes?.total ?? 0;
  }

  getStatsCompletionRate(): number {
    return this.statistics()?.courses?.completionRate ?? 0;
  }

  // ✅ Status badge severity
  getStatusSeverity(status: string): 'success' | 'info' | 'warn' | 'danger' | 'secondary' {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'info';
      case 'failed': return 'danger';
      case 'not_started': return 'secondary';
      default: return 'warn';
    }
  }

  // ✅ Retry loading
  retry() {
    this.loadData();
  }
}