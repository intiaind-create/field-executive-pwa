import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { BadgeModule } from 'primeng/badge';
import { SkeletonModule } from 'primeng/skeleton';
import { ConvexService } from '@/core/services/convex.service';
import { api } from '@convex/_generated/api';
import { Id } from '@convex/_generated/dataModel';
interface QuizModule {
  moduleId: Id<"training_modules">;
  moduleTitle: string;
  moduleDescription: string;
  courseId: Id<"training_courses">;
  courseTitle: string;
  estimatedMinutes: number;
  passingScore: number;
  lastAttempt: {
    attemptId: Id<"quiz_attempts">;
    scorePercentage: number;
    passed: boolean;
    completedAt: number;
  } | null;
}

@Component({
  selector: 'app-quiz-list',
  standalone: true,
  imports: [
    CommonModule, 
    RouterModule, 
    CardModule, 
    ButtonModule, 
    ProgressBarModule, 
    BadgeModule, 
    SkeletonModule
  ],
  templateUrl: './quiz-list.component.html',
  styleUrls: ['./quiz-list.component.scss']
})
export class QuizListComponent {
  private convexService = inject(ConvexService);
  
  // ✅ Signals for state management
  quizzes = signal<QuizModule[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);

  constructor() {
    this.loadQuizzes();
  }

  private async loadQuizzes() {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      const result = await this.convexService.client.query(
        api.training.executive.quiz.listAvailableQuizzes,
        { limit: 20 }
      );

      this.quizzes.set(result);
    } catch (err: any) {
      console.error('❌ Failed to load quizzes:', err);
      this.error.set(err.message || 'Failed to load quizzes');
    } finally {
      this.isLoading.set(false);
    }
  }

  // ✅ Helper: Check if has quizzes
  get hasQuizzes(): boolean {
    return this.quizzes().length > 0;
  }

  // ✅ Helper: Get quiz count
  get quizCount(): number {
    return this.quizzes().length;
  }

  // ✅ Reload quizzes
  refresh() {
    this.loadQuizzes();
  }
}