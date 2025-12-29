import { Component, inject, computed, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RadioButtonModule } from 'primeng/radiobutton';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { CardModule } from 'primeng/card';
import { SkeletonModule } from 'primeng/skeleton';
import { ToastModule } from 'primeng/toast';
import { Subject, takeUntil } from 'rxjs';
import { ConvexService } from '@/core/services/convex.service';
import { MessageService } from 'primeng/api';
import { Id } from '@convex/_generated/dataModel';
import { api } from '@convex/_generated/api';

interface QuizQuestion {
  _id: Id<"quiz_questions">;
  questionText: string;
  questionType: "multiplechoice" | "truefalse" | "shortanswer";
  options?: string[];
  points: number;
  difficulty?: "easy" | "medium" | "hard";
  imageId?: Id<"_storage">;
}

@Component({
  selector: 'app-quiz-take',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    RadioButtonModule, 
    ButtonModule, 
    ProgressBarModule, 
    CardModule, 
    SkeletonModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './quiz-take.component.html',
  styleUrl: './quiz-take.component.scss'
})
export class QuizTakeComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private convexService = inject(ConvexService);
  private messageService = inject(MessageService);
  
  private destroy$ = new Subject<void>();

  // ✅ State signals
  moduleId = signal<Id<"training_modules"> | null>(null);
  questions = signal<QuizQuestion[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  answers = signal<Map<number, string>>(new Map());
  currentQuestionIndex = signal(0);
  startedAt = signal(Date.now());
  isSubmitting = signal(false);
  
  // ✅ Computed values
  totalQuestions = computed(() => this.questions().length);
  
  currentProgress = computed(() => {
    const total = this.totalQuestions();
    const current = this.currentQuestionIndex() + 1;
    return total > 0 ? (current / total) * 100 : 0;
  });
  
  currentQuestion = computed(() => this.questions()[this.currentQuestionIndex()] || null);
  
  isFirstQuestion = computed(() => this.currentQuestionIndex() === 0);
  
  isLastQuestion = computed(() => this.currentQuestionIndex() === this.totalQuestions() - 1);

  // ✅ Get current answer for current question
  currentAnswer = computed(() => {
    return this.answers().get(this.currentQuestionIndex()) || '';
  });

  ngOnInit() {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const id = params.get('moduleId');
      if (id) {
        this.moduleId.set(id as Id<"training_modules">);
        this.loadQuizQuestions();
      }
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async loadQuizQuestions() {
    const moduleId = this.moduleId();
    if (!moduleId) return;

    try {
      this.isLoading.set(true);
      this.error.set(null);

      const result = await this.convexService.client.query(
        api.training.executive.quiz.getQuizQuestions,
        { moduleId, count: 20 }
      );

      this.questions.set(result);
      this.startedAt.set(Date.now()); // Reset timer when questions load
    } catch (err: any) {
      console.error('❌ Failed to load quiz:', err);
      this.error.set(err.message || 'Failed to load quiz questions');
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to load quiz questions'
      });
    } finally {
      this.isLoading.set(false);
    }
  }
getOptionLetter(index: number): string {
  return String.fromCharCode(65 + index); // A, B, C, D...
}
  prevQuestion() {
    if (!this.isFirstQuestion()) {
      this.currentQuestionIndex.update(idx => Math.max(0, idx - 1));
    }
  }

  nextQuestion() {
    if (this.isLastQuestion()) {
      this.confirmSubmit();
    } else {
      this.currentQuestionIndex.update(idx => Math.min(this.totalQuestions() - 1, idx + 1));
    }
  }

  selectAnswer(answer: string) {
    const newAnswers = new Map(this.answers());
    newAnswers.set(this.currentQuestionIndex(), answer);
    this.answers.set(newAnswers);
  }

  // ✅ Get elapsed time in minutes
  getElapsedTime(): string {
    const elapsed = Date.now() - this.startedAt();
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  // ✅ Get answered count
  getAnsweredCount(): number {
    return this.answers().size;
  }

  confirmSubmit() {
    const answeredCount = this.getAnsweredCount();
    const totalCount = this.totalQuestions();

    if (answeredCount < totalCount) {
      const unanswered = totalCount - answeredCount;
      const proceed = confirm(
        `You have ${unanswered} unanswered question(s). Submit anyway?`
      );
      if (!proceed) return;
    }

    this.submitQuiz();
  }

  async submitQuiz() {
    const moduleId = this.moduleId();
    if (!moduleId) return;

    const questionsData = this.questions();
    const answersMap = this.answers();

    // ✅ Build answers array
    const answersData = questionsData
      .map((question, index) => ({
        questionId: question._id,
        selectedAnswer: answersMap.get(index) || ''
      }))
      .filter(ans => ans.selectedAnswer); // Only answered questions

    if (answersData.length === 0) {
      this.messageService.add({
        severity: 'warn',
        summary: 'No Answers',
        detail: 'Please answer at least one question before submitting.'
      });
      return;
    }

    try {
      this.isSubmitting.set(true);

      const result = await this.convexService.client.mutation(
        api.training.executive.quiz.submitQuizAttempt,
        {
          moduleId,
          answers: answersData,
          startedAt: this.startedAt()
        }
      );

      this.messageService.add({
        severity: result.passed ? 'success' : 'info',
        summary: result.passed ? 'Quiz Passed!' : 'Quiz Completed',
        detail: `Score: ${result.scorePercentage}%`
      });

      // ✅ Navigate to results with attempt ID
      this.router.navigate(['/training/quiz/results', result.attemptId]);
      
    } catch (err: any) {
      console.error('❌ Quiz submission failed:', err);
      this.messageService.add({
        severity: 'error',
        summary: 'Submission Failed',
        detail: err.message || 'Please try again.'
      });
    } finally {
      this.isSubmitting.set(false);
    }
  }

  // ✅ Retry loading
  retry() {
    this.loadQuizQuestions();
  }
}