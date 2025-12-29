import { ConvexService } from '@/core/services/convex.service';
import { inject, Injectable } from '@angular/core';
import { api } from '@convex/_generated/api';

@Injectable({ providedIn: 'root' })
export class QuizService {
  private convex = inject(ConvexService);

  listAvailableQuizzes(limit = 20) {
    return this.convex.query(api.training.executive.quiz.listAvailableQuizzes, { limit });
  }

  getQuizQuestions(moduleId: string, count = 20) {
    return this.convex.query(api.training.executive.quiz.getQuizQuestions, { moduleId, count });
  }

  submitQuizAttempt(moduleId: string, answers: any[], startedAt: number) {
    return this.convex.mutation(api.training.executive.quiz.submitQuizAttempt, {
      moduleId, answers, startedAt
    });
  }

  getMyQuizHistory(limit = 10, moduleId?: string) {
    return this.convex.query(api.training.executive.quiz.getMyQuizHistory, { limit, moduleId });
  }
}
