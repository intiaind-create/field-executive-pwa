import { Component, inject, computed, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { CardModule } from 'primeng/card';
import { ProgressBarModule } from 'primeng/progressbar';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { TableModule } from 'primeng/table';
import { DividerModule } from 'primeng/divider';
import { SkeletonModule } from 'primeng/skeleton';
import { useQuery } from 'convex/react';
import { MessageService } from 'primeng/api';
import { api } from '@convex/_generated/api';
import { ToastModule } from 'primeng/toast';
import { ConvexService } from '@/core/services/convex.service';
import { Id } from '@convex/_generated/dataModel';

interface AttemptDetails {
  _id: Id<"quiz_attempts">;
  scorePercentage: number;
  passed: boolean;
  correctAnswers: number;
  totalQuestions: number;
  totalPoints: number;
  earnedPoints: number;
  timeSpentMinutes: number;
  completedAt: number;
  answers: Array<{
    questionId: Id<"quiz_questions">;
    questionText: string;
    selectedAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    pointsEarned: number;
  }>;
  moduleTitle?: string;
  courseTitle?: string;
  passingScore?: number;
}

@Component({
  selector: 'app-quiz-results',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    CardModule, 
    ProgressBarModule, 
    ButtonModule, 
    BadgeModule, 
    TableModule, 
    DividerModule, 
    SkeletonModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './quiz-results.component.html',
  styleUrls: ['./quiz-results.component.scss']
})
export class QuizResultsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private convexService = inject(ConvexService);
  private messageService = inject(MessageService);
  
  // ✅ State signals
  attemptDetails = signal<AttemptDetails | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  moduleId = signal<Id<"training_modules"> | null>(null);
  
  // ✅ Computed values
  isPassed = computed(() => this.attemptDetails()?.passed ?? false);
  scorePercentage = computed(() => this.attemptDetails()?.scorePercentage ?? 0);
  
  ngOnInit() {
    // Get attemptId from route params
    const attemptId = this.route.snapshot.paramMap.get('attemptId');
    
    if (attemptId) {
      this.loadAttemptDetails(attemptId as Id<"quiz_attempts">);
    } else {
      this.error.set('No attempt ID provided');
      this.isLoading.set(false);
    }
  }

  private async loadAttemptDetails(attemptId: Id<"quiz_attempts">) {
    try {
      this.isLoading.set(true);
      this.error.set(null);

      const result = await this.convexService.client.query(
        api.training.executive.quiz.getAttemptDetails,
        { attemptId }
      );

      this.attemptDetails.set(result);
      
      // Extract moduleId from the attempt for retake functionality
      const moduleId = result._id.split('_')[0]; // This is a workaround
      // Better: Get moduleId from backend if available
      
    } catch (err: any) {
      console.error('❌ Failed to load quiz results:', err);
      this.error.set(err.message || 'Failed to load quiz results');
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load quiz results'
      });
    } finally {
      this.isLoading.set(false);
    }
  }

  retakeQuiz() {
    const details = this.attemptDetails();
    if (!details) return;

    // Navigate back to quiz-list, user can select quiz again
    // Or if you have moduleId stored, navigate directly
    this.router.navigate(['/training/quiz']);
  }

  viewQuizzes() {
    this.router.navigate(['/training/quiz']);
  }

  getCorrectAnswers(): number {
    return this.attemptDetails()?.correctAnswers ?? 0;
  }

  getTotalQuestions(): number {
    return this.attemptDetails()?.totalQuestions ?? 0;
  }

  getTotalPoints(): number {
    return this.attemptDetails()?.totalPoints ?? 0;
  }

  getEarnedPoints(): number {
    return this.attemptDetails()?.earnedPoints ?? 0;
  }

  getTimeSpent(): number {
    return this.attemptDetails()?.timeSpentMinutes ?? 0;
  }

  getPassingScore(): number {
    return this.attemptDetails()?.passingScore ?? 70;
  }

  getAccuracyPercentage(): number {
    const details = this.attemptDetails();
    if (!details || details.totalQuestions === 0) return 0;
    return (details.correctAnswers / details.totalQuestions) * 100;
  }

  retry() {
    const attemptId = this.route.snapshot.paramMap.get('attemptId');
    if (attemptId) {
      this.loadAttemptDetails(attemptId as Id<"quiz_attempts">);
    }
  }
}
