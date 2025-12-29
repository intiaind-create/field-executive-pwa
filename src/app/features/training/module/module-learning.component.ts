import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConvexService } from '../../../core/services/convex.service';
import { AuthService } from '../../../core/auth/services/auth.service';
import { api } from '@convex/_generated/api';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface QuizQuestion {
  _id: string;
  questionText: string;
  questionType: 'multiplechoice' | 'truefalse' | 'shortanswer';
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  points: number;
}

export interface ModuleDetail {
  _id: string;
  title: string;
  description: string;
  contentType: 'video' | 'document' | 'quiz' | 'interactive';
  contentUrl: string | null;
  estimatedMinutes: number;
  courseName: string;
  quizQuestions: QuizQuestion[];
  myProgress?: {
    status: string;
    completedAt?: number;
    score?: number;
  };
}

@Component({
  selector: 'app-module-learning',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './module-learning.component.html'
})
export class ModuleLearningComponent implements OnInit {
  private convex = inject(ConvexService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private sanitizer = inject(DomSanitizer);

  module = signal<ModuleDetail | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  
  // Quiz state
  quizAnswers = signal<Map<string, string>>(new Map());
  isSubmitting = signal(false);
  quizResult = signal<{ score: number; correctAnswers: number; totalQuestions: number } | null>(null);
  
  // Timer
  startTime = Date.now();

  courseId = '';
  progressId = '';

  async ngOnInit() {
    await this.authService.waitForAuth();
    
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    this.courseId = this.route.snapshot.paramMap.get('courseId') || '';
    const moduleId = this.route.snapshot.paramMap.get('moduleId') || '';
    
    if (moduleId) {
      await this.loadModule(moduleId);
    }
  }

  async loadModule(moduleId: string) {
    this.isLoading.set(true);
    this.error.set(null);

    try {
      const moduleData = await this.convex.query<ModuleDetail>(
        api.training.executive.queries.getModuleDetails,
        { moduleId }
      );

      this.module.set(moduleData);
      console.log('✅ Module loaded:', moduleData.title);
    } catch (error: any) {
      console.error('Failed to load module:', error);
      this.error.set(error.message || 'Failed to load module');
    } finally {
      this.isLoading.set(false);
    }
  }

  getSafeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  setQuizAnswer(questionId: string, answer: string) {
    const current = this.quizAnswers();
    current.set(questionId, answer);
    this.quizAnswers.set(new Map(current));
  }

  getQuizAnswer(questionId: string): string {
    return this.quizAnswers().get(questionId) || '';
  }

  async submitQuiz() {
    const module = this.module();
    if (!module || module.contentType !== 'quiz') return;

    // Validate all questions answered
    const unanswered = module.quizQuestions.filter(
      q => !this.quizAnswers().has(q._id)
    );

    if (unanswered.length > 0) {
      alert(`Please answer all questions (${unanswered.length} remaining)`);
      return;
    }

    this.isSubmitting.set(true);

    try {
      const timeSpent = Math.ceil((Date.now() - this.startTime) / (1000 * 60));
      
      // Get progress ID from course detail query
      const courseDetail = await this.convex.query<any>(
        api.training.executive.queries.getCourseDetails,
        { courseId: this.courseId }
      );

      if (!courseDetail.myProgress) {
        throw new Error('Not enrolled in this course');
      }

      const answers = Array.from(this.quizAnswers().entries()).map(([questionId, answer]) => ({
        questionId,
        answer
      }));

      const result = await this.convex.mutation<any>(
        api.training.executive.mutations.submitQuizAnswers,
        {
          progressId: courseDetail.myProgress._id,
          moduleId: module._id,
          answers,
          timeSpentMinutes: timeSpent
        }
      );

      this.quizResult.set({
        score: result.score,
        correctAnswers: result.correctAnswers,
        totalQuestions: result.totalQuestions
      });

      console.log('✅ Quiz submitted:', result);
      
      // Redirect after showing result
      setTimeout(() => {
        this.router.navigate(['/training', this.courseId]);
      }, 3000);
      
    } catch (error: any) {
      console.error('Failed to submit quiz:', error);
      alert(error.message || 'Failed to submit quiz');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async completeModule() {
    const module = this.module();
    if (!module || module.contentType === 'quiz') return;

    try {
      const timeSpent = Math.ceil((Date.now() - this.startTime) / (1000 * 60));
      
      const courseDetail = await this.convex.query<any>(
        api.training.executive.queries.getCourseDetails,
        { courseId: this.courseId }
      );

      if (!courseDetail.myProgress) {
        throw new Error('Not enrolled in this course');
      }

      await this.convex.mutation(
        api.training.executive.mutations.completeModule,
        {
          progressId: courseDetail.myProgress._id,
          moduleId: module._id,
          timeSpentMinutes: timeSpent
        }
      );

      console.log('✅ Module completed');
      this.router.navigate(['/training', this.courseId]);
      
    } catch (error: any) {
      console.error('Failed to complete module:', error);
      alert(error.message || 'Failed to complete module');
    }
  }

  goBack() {
    this.router.navigate(['/training', this.courseId]);
  }

  getContentIcon(contentType: string): string {
    const icons: Record<string, string> = {
      'video': '🎥',
      'document': '📄',
      'quiz': '📝',
      'interactive': '🎮'
    };
    return icons[contentType] || '📚';
  }
}