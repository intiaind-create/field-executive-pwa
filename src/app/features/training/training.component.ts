import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConvexService } from '../../core/services/convex.service';
import { AuthService } from '../../core/auth/services/auth.service';
import { api } from '@convex/_generated/api';

export interface TrainingCourse {
  _id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedHours: number;
  totalModules: number;
  passingScore: number;
  completionRate: number;
  isActive: boolean;
}

export interface TrainingProgress {
  _id: string;
  courseId: string;
  completedModules: number;
  totalModules: number;
  progressPercentage: number;
  status: 'not_started' | 'in_progress' | 'completed' | 'failed';
  finalScore?: number;
  certificateId?: string;
  startedAt: number;
  lastAccessedAt: number;
}

@Component({
  selector: 'app-training',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: 'training.component.html',
  styles: [`
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
  `]
})
export class TrainingComponent implements OnInit {
  private convex = inject(ConvexService);
  private authService = inject(AuthService);
  private router = inject(Router);

  // State
  courses = signal<TrainingCourse[]>([]);
  myProgress = signal<Map<string, TrainingProgress>>(new Map());
  isLoading = signal(true);
  error = signal<string | null>(null);
  
  // Filters
  selectedCategory = signal<string | null>(null);
  selectedDifficulty = signal<string | null>(null);
  searchQuery = signal('');
  
  // Computed
  categories = computed(() => {
    const cats = new Set(this.courses().map(c => c.category));
    return Array.from(cats);
  });
  
  filteredCourses = computed(() => {
    let filtered = this.courses();
    
    // Filter by category
    if (this.selectedCategory()) {
      filtered = filtered.filter(c => c.category === this.selectedCategory());
    }
    
    // Filter by difficulty
    if (this.selectedDifficulty()) {
      filtered = filtered.filter(c => c.difficulty === this.selectedDifficulty());
    }
    
    // Search
    if (this.searchQuery().trim()) {
      const query = this.searchQuery().toLowerCase();
      filtered = filtered.filter(c =>
        c.title.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  });

  async ngOnInit() {
    await this.authService.waitForAuth();
    
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    
    await this.loadTraining();
  }

  async loadTraining() {
    this.isLoading.set(true);
    this.error.set(null);
    
    try {
      // Load courses and progress in parallel
      const [coursesData, progressData] = await Promise.all([
        this.convex.query<{ page: TrainingCourse[]; isDone: boolean }>(
          api.training.executive.queries.listCourses,
          { paginationOpts: { numItems: 50, cursor: null } }
        ),
        this.convex.query<TrainingProgress[]>(
          api.training.executive.queries.getMyProgress,
          {}
        )
      ]);
      
      this.courses.set(coursesData.page);
      
      // Build progress map
      const progressMap = new Map<string, TrainingProgress>();
      progressData.forEach(p => progressMap.set(p.courseId, p));
      this.myProgress.set(progressMap);
      
      console.log('✅ Training loaded:', this.courses().length, 'courses');
    } catch (error: any) {
      console.error('Failed to load training:', error);
      this.error.set(error.message || 'Failed to load training');
    } finally {
      this.isLoading.set(false);
    }
  }

  getProgress(courseId: string): TrainingProgress | null {
    return this.myProgress().get(courseId) || null;
  }

  getStatusBadge(status: string): { class: string; text: string } {
    const map: Record<string, { class: string; text: string }> = {
      'not_started': { class: 'bg-gray-100 text-gray-800', text: 'Not Started' },
      'in_progress': { class: 'bg-blue-100 text-blue-800', text: 'In Progress' },
      'completed': { class: 'bg-green-100 text-green-800', text: 'Completed' },
      'failed': { class: 'bg-red-100 text-red-800', text: 'Failed' }
    };
    return map[status] || map['not_started'];
  }

  getDifficultyBadge(difficulty: string): { class: string; icon: string } {
    const map: Record<string, { class: string; icon: string }> = {
      'beginner': { class: 'bg-green-100 text-green-800', icon: '🌱' },
      'intermediate': { class: 'bg-yellow-100 text-yellow-800', icon: '⚡' },
      'advanced': { class: 'bg-red-100 text-red-800', icon: '🔥' }
    };
    return map[difficulty] || map['beginner'];
  }

  // ✅ SIMPLIFIED: Just navigate - enrollment happens automatically
  startCourse(course: TrainingCourse) {
    this.router.navigate(['/training', course._id]);
  }

  viewCourse(course: TrainingCourse) {
    this.router.navigate(['/training', course._id]);
  }

  viewCertificate(progress: TrainingProgress) {
    if (progress.certificateId) {
      // Open certificate in new tab
      window.open(`/api/certificate/${progress.certificateId}`, '_blank');
    }
  }

  onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }

  clearSearch() {
    this.searchQuery.set('');
  }

  selectCategory(category: string | null) {
    this.selectedCategory.set(category);
  }

  selectDifficulty(difficulty: string | null) {
    this.selectedDifficulty.set(difficulty);
  }
}