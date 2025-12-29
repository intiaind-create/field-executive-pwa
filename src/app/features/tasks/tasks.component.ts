import { Component, signal, inject, computed, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConvexService } from '../../core/services/convex.service';
import { AuthService } from '../../core/auth/services/auth.service';
import { OfflineSyncService } from '../../core/services/offline-sync.service';
import { OfflineStorageService } from '../../core/services/offline-storage.service';
import { api } from '@convex/_generated/api';

export interface Task {
  _id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  type: string;
  dueDate: number;
  estimatedDuration?: number;
  location?: {
    address: string;
    lat: number;
    lng: number;
  };
  isOverdue: boolean;
  daysUntilDue: number;
}

type FilterType = 'all' | 'pending' | 'in_progress' | 'completed' | 'overdue';

@Component({
  selector: 'app-tasks',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './tasks.component.html',
  styles: [`
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
  `]
})
export class TasksComponent implements OnInit {
  // Injections
  private router = inject(Router);
  private authService = inject(AuthService);
  private convex = inject(ConvexService);
  private offlineSync = inject(OfflineSyncService);
  private offlineStorage = inject(OfflineStorageService);

  // State Signals
  tasks = signal<Task[]>([]);
  isLoading = signal(true);
  error = signal<string | null>(null);
  
  // UI State
  activeFilter = signal<FilterType>('all');
  searchQuery = signal('');
  expandedTasks = new Set<string>();

  // Filter Keys
  filterKeys: FilterType[] = ['all', 'pending', 'in_progress', 'completed', 'overdue'];

  // ✅ Offline state
  isOnline = this.offlineSync.isOnline;
  pendingActions = this.offlineStorage.pendingActionsCount;

  // Computed
  filteredTasks = computed(() => {
    let filtered = this.tasks();
    const filter = this.activeFilter();
    
    if (filter === 'overdue') {
      filtered = filtered.filter(task => task.isOverdue);
    } else if (filter !== 'all') {
      filtered = filtered.filter(task => task.status === filter);
    }
    
    if (this.searchQuery().trim()) {
      const query = this.searchQuery().toLowerCase();
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.type.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return (a.dueDate || 0) - (b.dueDate || 0);
    });
  });

  taskCounts = computed(() => {
    const counts: Record<FilterType, number> = {
      'all': this.tasks().length,
      'pending': 0,
      'in_progress': 0,
      'completed': 0,
      'overdue': 0
    };

    this.tasks().forEach(task => {
      if (task.status in counts) {
        counts[task.status as Exclude<FilterType, 'all' | 'overdue'>]++;
      }
      if (task.isOverdue) {
        counts.overdue++;
      }
    });

    return counts;
  });

  constructor() {
    effect(() => {
      if (this.authService.isAuthenticated()) {
        this.refreshTasks();
      }
    });

    // ✅ Auto-sync when coming back online
    effect(() => {
      if (this.isOnline()) {
        this.offlineSync.syncPendingActions();
      }
    });
  }

  async ngOnInit() {
    if (this.authService.isAuthenticated()) {
      await this.refreshTasks();
    }
  }

  async refreshTasks() {
    this.isLoading.set(true);
    this.error.set(null);
    
    try {
      const tasksData = await this.convex.query<any[]>(
        api.tasks.me.queries.getMyTasks,
        {}
      );
      
      const now = Date.now();
      const transformed: Task[] = tasksData.map(task => ({
        ...task,
        isOverdue: task.status !== 'completed' && task.dueDate < now,
        daysUntilDue: Math.ceil((task.dueDate - now) / (1000 * 60 * 60 * 24))
      }));

      this.tasks.set(transformed);
      console.log('✅ Tasks loaded:', this.tasks().length);
    } catch (error: any) {
      console.error('Failed to load tasks:', error);
      this.error.set(error.message || 'Failed to load tasks');
    } finally {
      this.isLoading.set(false);
    }
  }

  setFilter(filter: FilterType) {
    this.activeFilter.set(filter);
  }

  getFilterDisplayName(filter: FilterType): string {
    const names: Record<FilterType, string> = {
      'all': 'All',
      'pending': 'Pending',
      'in_progress': 'In Progress',
      'completed': 'Done',
      'overdue': 'Overdue'
    };
    return names[filter];
  }

  toggleTask(taskId: string) {
    if (this.expandedTasks.has(taskId)) {
      this.expandedTasks.delete(taskId);
    } else {
      this.expandedTasks.add(taskId);
    }
  }

  trackByTaskId(index: number, task: Task): string {
    return task._id;
  }

  // ✅ OFFLINE-ENABLED: Start Task
  async startTask(task: Task) {
    try {
      console.log('🚀 Starting task:', task._id);

      // ✅ Optimistic update
      this.updateTaskLocally(task._id, 'in_progress');

      if (this.isOnline()) {
        // Online: Execute immediately
        await this.convex.mutation(api.tasks.me.mutation.updateTaskStatus, {
          taskId: task._id,
          status: 'in_progress'
        });
        console.log('✅ Task started online');
      } else {
        // Offline: Queue for later
        this.offlineSync.queueAction('startTask', {
          taskId: task._id
        });
        console.log('📥 Task start queued for offline sync');
      }

      await this.refreshTasks();
    } catch (error: any) {
      console.error('Failed to start task:', error);
      this.error.set('Failed to start task');
      // Revert optimistic update
      this.updateTaskLocally(task._id, task.status);
    }
  }

  // ✅ OFFLINE-ENABLED: Complete Task
  async markComplete(task: Task) {
    try {
      console.log('✅ Completing task:', task._id);

      // Get current location (optional)
      let location = undefined;
      if (navigator.geolocation) {
        try {
          const pos = await this.getCurrentPosition();
          location = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            address: 'Location captured'
          };
        } catch (err) {
          console.warn('Could not get location:', err);
        }
      }

      // ✅ Optimistic update
      this.updateTaskLocally(task._id, 'completed');

      if (this.isOnline()) {
        // Online: Execute immediately
        await this.convex.mutation(api.tasks.me.mutation.updateTaskStatus, {
          taskId: task._id,
          status: 'completed',
          location
        });
        console.log('✅ Task completed online');
      } else {
        // Offline: Queue for later
        this.offlineSync.queueAction('completeTask', {
          taskId: task._id,
          location
        });
        console.log('📥 Task completion queued for offline sync');
      }

      await this.refreshTasks();
    } catch (error: any) {
      console.error('Failed to complete task:', error);
      this.error.set('Failed to complete task');
      // Revert optimistic update
      this.updateTaskLocally(task._id, task.status);
    }
  }

  // ✅ Optimistic local update
  private updateTaskLocally(taskId: string, status: Task['status']) {
    const currentTasks = this.tasks();
    const updatedTasks = currentTasks.map(t => 
      t._id === taskId ? { ...t, status } : t
    );
    this.tasks.set(updatedTasks);
  }

  // Helper to get current position
  private getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        timeout: 5000,
        maximumAge: 60000
      });
    });
  }

  clearSearch() {
    this.searchQuery.set('');
  }

  onSearchInput(event: Event) {
    const target = event.target as HTMLInputElement;
    this.searchQuery.set(target.value);
  }
}