import { Routes } from '@angular/router';
import { ForgotPasswordDialogComponent } from './core/auth/forgot-password-dialogue/forgot-password-dialog.component';
import { authGuard } from './core/auth/guards/auth.guard';
import { LoginComponent } from './core/auth/login/login.component';
import { SetupPasswordComponent } from './core/auth/setup-password/setup-password.component';
import { SettingsComponent } from './core/layout/settings/settings.component';
import { AttendanceComponent } from './features/attendance/attendance.component';
import { DashboardComponent } from './features/dashboard/dashboard';
import { ProfileComponent } from './features/profile/profile.component';
import { TasksComponent } from './features/tasks/tasks.component';
import { CertificatesComponent } from './features/training/certificates/certificates.component';
import { CourseDetailComponent } from './features/training/course/course-detail.component';
import { ModuleLearningComponent } from './features/training/module/module-learning.component';
import { TrainingComponent } from './features/training/training.component';
import { StoreComponent } from './store/store.component';
import { OrdersComponent } from './store/orders/orders.component';
import { CheckoutComponent } from './store/checkout/checkout.component';
import { OrderDetailComponent } from './store/order-detail/order-detail.component';
import { ProgressComponent } from './features/training/progress/progress.component';
import { QuizListComponent } from './features/training/quiz/quiz-list/quiz-list.component';
import { QuizResultsComponent } from './features/training/quiz/quiz-result/quiz-results.component';
import { QuizTakeComponent } from './features/training/quiz/quiz-take/quiz-take.component';
import { TaskDetailComponent } from './features/tasks/task-detail/task-detail.component';

export const routes: Routes = [
  // ============================================================================
  // PUBLIC ROUTES
  // ============================================================================
  {
    path: 'login',
    component: LoginComponent,
    data: { hideNav: true },
  },
  {
    path: 'setup-password',
    component: SetupPasswordComponent,
    data: { hideNav: true },
  },
  {
    path: 'reset-password',
    component: ForgotPasswordDialogComponent,
    data: { hideNav: true },
  },

  // ============================================================================
  // PROTECTED ROUTES
  // ============================================================================
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },

      // Main Navigation
      {
        path: 'dashboard',
        component: DashboardComponent,
      },
      {
        path: 'tasks',
        component: TasksComponent,
      },
      {
        path: 'tasks/:id', // ✅ Add this
        component: TaskDetailComponent,
      },
      {
        path: 'attendance',
        component: AttendanceComponent,
      },
      {
        path: 'profile',
        component: ProfileComponent,
      },
      {
        path: 'settings',
        component: SettingsComponent,
      },

      // ========================================================================
      // TRAINING MODULE
      // ========================================================================
      {
        path: 'training',
        component: TrainingComponent,
      },
      {
        path: 'training/certificates',
        component: CertificatesComponent,
      },

      // ✅ Quiz Routes (specific routes FIRST)
      {
        path: 'training/quiz',
        component: QuizListComponent,
      },
      {
        path: 'training/quiz/results/:attemptId',
        component: QuizResultsComponent,
      },
      {
        path: 'training/quiz/:moduleId',
        component: QuizTakeComponent,
      },

      // ✅ Progress Routes
      {
        path: 'training/progress',
        component: ProgressComponent,
      },
      {
        path: 'training/progress/:courseId',
        component: ProgressComponent, // ✅ Can reuse same component with route params
      },

      // Course Routes (dynamic routes LAST)
      {
        path: 'training/:courseId',
        component: CourseDetailComponent,
      },
      {
        path: 'training/:courseId/module/:moduleId',
        component: ModuleLearningComponent,
      },

      // ========================================================================
      // STORE MODULE
      // ========================================================================
      {
        path: 'store',
        component: StoreComponent,
      },
      {
        path: 'store/checkout',
        component: CheckoutComponent,
      },
      {
        path: 'store/orders',
        component: OrdersComponent,
      },
      {
        path: 'store/orders/:id',
        component: OrderDetailComponent,
      },
    ],
  },

  // ============================================================================
  // FALLBACK
  // ============================================================================
  {
    path: '**',
    redirectTo: 'login',
  },
];
