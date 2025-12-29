import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { ConvexService } from '../../../core/services/convex.service';
import { AuthService } from '../../../core/auth/services/auth.service';
import { api } from '@convex/_generated/api';

export interface Module {
  _id: string;
  title: string;
  description: string;
  order: number;
  estimatedMinutes: number;
  contentType: 'video' | 'document' | 'quiz' | 'interactive';
  isRequired: boolean;
  progress: {
    status: 'not_started' | 'in_progress' | 'completed';
    completedAt?: number;
    score?: number;
    timeSpentMinutes: number;
  } | null;
}

export interface CourseDetail {
  _id: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  estimatedHours: number;
  totalModules: number;
  passingScore: number;
  modules: Module[];
  myProgress?: {
    _id: string;
    completedModules: number;
    totalModules: number;
    progressPercentage: number;
    status: string;
    finalScore?: number;
  };
}

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: 'course-detail.component.html'
})
export class CourseDetailComponent implements OnInit {
  private convex = inject(ConvexService);
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  course = signal<CourseDetail | null>(null);
  isLoading = signal(true);
  error = signal<string | null>(null);
  isStartingModule = signal(false); // ✅ Track module start loading state

  async ngOnInit() {
    console.log('🔵 CourseDetail: ngOnInit started');
    
    await this.authService.waitForAuth();
    
    if (!this.authService.isAuthenticated()) {
      console.log('❌ Not authenticated, redirecting to login');
      this.router.navigate(['/login']);
      return;
    }

    const courseId = this.route.snapshot.paramMap.get('courseId'); // ✅ Fixed: using 'courseId'
    console.log('🔵 CourseDetail: courseId from route =', courseId);
    
    if (courseId) {
      await this.loadCourse(courseId);
    } else {
      console.log('❌ No courseId in route params');
      this.error.set('No course ID provided');
      this.isLoading.set(false);
    }
  }

  async loadCourse(courseId: string) {
    this.isLoading.set(true);
    this.error.set(null);
    
    console.log('🔵 loadCourse: Starting for courseId =', courseId);

    try {
      // ✅ STEP 1: Try to enroll first (idempotent)
      console.log('📝 Enrolling/checking enrollment...');
      
      try {
        await this.convex.mutation(
          api.training.executive.progress.startCourse,
          { courseId }
        );
        console.log('✅ Enrollment completed/verified');
      } catch (enrollError: any) {
        console.warn('⚠️ Enrollment error (might already be enrolled):', enrollError.message);
      }

      // ✅ STEP 2: Load course data
      console.log('🔵 Loading course details...');
      
      let rawData: any = null;
      
      // Try progress.getCourseProgress
      try {
        rawData = await this.convex.query(
          api.training.executive.progress.getCourseProgress,
          { courseId }
        );
        console.log('✅ Loaded via progress.getCourseProgress');
      } catch (err1) {
        console.log('⚠️ progress.getCourseProgress not available, trying queries...');
        
        // Try queries.getCourseDetails
        try {
          rawData = await this.convex.query(
            api.training.executive.queries.getCourseDetails,
            { courseId }
          );
          console.log('✅ Loaded via queries.getCourseDetails');
        } catch (err2) {
          throw new Error('Could not load course. Please check backend API configuration.');
        }
      }

      console.log('✅ Raw data received:', rawData);

      // ✅ STEP 3: Transform nested structure to flat structure
      let courseData: CourseDetail;
      
      if (rawData.course && rawData.progress) {
        // Backend returns nested structure: { course: {...}, progress: {...}, modules: [...] }
        console.log('🔄 Transforming nested structure to flat structure');
        courseData = {
          _id: rawData.course._id,
          title: rawData.course.title,
          description: rawData.course.description,
          category: rawData.course.category,
          difficulty: rawData.course.difficulty,
          estimatedHours: rawData.course.estimatedHours,
          passingScore: rawData.course.passingScore,
          totalModules: rawData.course.totalModules,
          modules: rawData.modules.map((m: any) => ({
            _id: m.moduleId || m._id,
            title: m.title,
            description: m.description,
            order: m.order,
            estimatedMinutes: m.estimatedMinutes,
            contentType: m.contentType,
            isRequired: m.isRequired,
            progress: m.progress,
          })),
          myProgress: rawData.progress ? {
            _id: rawData.progress.progressId || rawData.progress._id,
            completedModules: rawData.progress.completedModules,
            totalModules: rawData.progress.totalModules,
            progressPercentage: rawData.progress.progressPercentage,
            status: rawData.progress.status,
            finalScore: rawData.progress.finalScore,
          } : undefined,
        };
      } else {
        // Backend returns flat structure: { _id, title, ..., myProgress, modules }
        console.log('✅ Data already in flat structure');
        courseData = rawData;
      }

      console.log('✅ Transformed course data:', courseData);
      console.log('✅ Progress exists:', !!courseData.myProgress);
      
      this.course.set(courseData);
      console.log('✅ Course loaded successfully');
      
    } catch (error: any) {
      console.error('❌ loadCourse failed:', error);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
      this.error.set(error.message || 'Failed to load course');
    } finally {
      console.log('🔵 loadCourse: Setting isLoading to false');
      this.isLoading.set(false);
    }
  }

  getModuleIcon(contentType: string): string {
    const icons: Record<string, string> = {
      'video': '🎥',
      'document': '📄',
      'quiz': '📝',
      'interactive': '🎮'
    };
    return icons[contentType] || '📚';
  }

  getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      'not_started': '⭕',
      'in_progress': '🔵',
      'completed': '✅'
    };
    return icons[status] || '⭕';
  }

  async startModule(module: Module) {
    console.log('🔵 startModule clicked! module =', module);
    
    const course = this.course();
    console.log('🔵 startModule: course =', course);
    
    if (!course || !course.myProgress) {
      console.log('❌ Cannot start module: no course or progress');
      alert('Please enroll in this course first');
      return;
    }

    this.isStartingModule.set(true);

    try {
      console.log('🔵 Navigating directly to module (skipping progress update)...');
      console.log('🔵 Navigation path:', ['/training', course._id, 'module', module._id]);
      
      // ✅ Navigate directly - let module-learning component handle progress updates
      await this.router.navigate(['/training', course._id, 'module', module._id]);
      
      console.log('✅ Navigation completed');
    } catch (error: any) {
      console.error('❌ Failed to navigate to module:', error);
      alert(`Failed to open module: ${error.message}`);
      this.isStartingModule.set(false);
    }
  }
}