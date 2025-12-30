  import { Component, input, output, signal, inject, computed, OnInit } from '@angular/core';
  import { CommonModule } from '@angular/common';
  import { FormsModule } from '@angular/forms';
  import { toObservable, toSignal } from '@angular/core/rxjs-interop';
  import { ConvexService } from '../../../core/services/convex.service';
  import { switchMap, of } from 'rxjs';
  import { ActivatedRoute, Router, RouterModule } from '@angular/router';
  import { AuthService } from '../../../core/auth/services/auth.service';
  import { api } from '@convex/_generated/api';
  import { CheckboxModule } from 'primeng/checkbox';
  export interface Voter {
    id: string;
    voterId: string;
    name: string;
    age?: number;
    gender?: string;
    phone?: string;
    address?: string;
    status: 'visited' | 'pending' | 'notinterested';
    notes?: string;
    validated?: boolean;  // 🔥 NEW - Validation checkbox
  }

  export interface Task {
    id: string;
    title: string;
    description: string;
    status: 'pending' | 'inprogress' | 'completed' | 'cancelled';
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
    votersList?: string[];  // 🔥 From Admin CSV
  }

  @Component({
    selector: 'app-task-detail',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule,CheckboxModule],
    templateUrl: './task-detail.component.html',
    styles: [`
      .scrollbar-hide {
        -webkit-scrollbar { display: none; }
      }
    `]
  })
  export class TaskDetailComponent implements OnInit {
    // Injections
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private authService = inject(AuthService);
    private convex = inject(ConvexService);

    // State Signals
    task = signal<Task | null>(null);
    isLoading = signal(true);
    error = signal<string | null>(null);
    
    // 🔥 VOTERS FROM ADMIN
    voters = signal<Voter[]>([]);
    votersList: string[] = [];
    loadingVoters = signal(false);
    showVoters = signal(false);
    expandedVoters = new Set<string>();
    
    // 🔥 VALIDATION
    allVotersValidated = computed(() => 
      this.voters().every(v => v.validated !== false)
    );

    ngOnInit() {
      const taskId = this.route.snapshot.paramMap.get('id');
      if (taskId) {
        this.loadTask(taskId);
      }
    }

    async loadTask(taskId: string) {
      this.isLoading.set(true);
      this.error.set(null);
      
      try {
        const taskData = await this.convex.query<any>(
          api.tasks.me.queries.getTaskById, 
          { taskId }
        );
        
        const now = Date.now();
        this.task.set({
          ...taskData,
          isOverdue: taskData.status !== 'completed' && taskData.dueDate < now,
          daysUntilDue: Math.ceil((taskData.dueDate - now) / (1000 * 60 * 60 * 24))
        });
        
        // 🔥 LOAD VOTERS FROM task.votersList
        await this.loadTaskVoters();
        
      } catch (error: any) {
        console.error('Failed to load task:', error);
        this.error.set(error.message || 'Failed to load task');
      } finally {
        this.isLoading.set(false);
      }
    }

    // 🔥 LOAD VOTERS FROM ADMIN CSV votersList
    async loadTaskVoters() {
      const taskVotersList = this.task()?.votersList;
      if (!taskVotersList?.length) return;
      
      this.votersList = taskVotersList;
      this.loadingVoters.set(true);
      
      try {
        // Create voters from votersList (mock data until real voters table)
        const votersData: Voter[] = taskVotersList.map(id => ({
          id,
          voterId: id,
          name: `Voter ${id.slice(-6)}`,  // Extract from CSV name
          age: 35,
          gender: 'Male',
          status: 'pending',
          validated: false  // 🔥 Start unvalidated
        }));
        
        this.voters.set(votersData);
      } catch (error) {
        console.error('Failed to load voters:', error);
      } finally {
        this.loadingVoters.set(false);
      }
    }

    // 🔥 VALIDATION CHECKBOX
    toggleVoterValidation(voterId: string) {
      const voters = [...this.voters()];
      const voter = voters.find(v => v.id === voterId);
      if (voter) {
        voter.validated = !voter.validated;
        this.voters.set(voters);
      }
    }

    // 🔥 SUBMIT FOR APPROVAL (only if all validated)
    async submitForApproval() {
      if (!this.allVotersValidated()) {
        alert('Please validate all voters first');
        return;
      }
      
      try {
        await this.updateTaskStatus('completed');
      } catch (error) {
        console.error('Approval failed', error);
      }
    }

    toggleVotersList() {
      if (!this.showVoters()) {
        this.loadTaskVoters();
      }
      this.showVoters.set(!this.showVoters());
    }

    toggleVoter(voterId: string) {
      if (this.expandedVoters.has(voterId)) {
        this.expandedVoters.delete(voterId);
      } else {
        this.expandedVoters.add(voterId);
      }
    }

    trackByVoterId(index: number, voter: Voter): string {
      return voter.id;
    }

  async updateTaskStatus(status: 'inprogress' | 'completed') {
    if (!this.task()) return;
    
    try {
      await this.convex.mutation(api.tasks.me.mutation.updateTaskStatus, {
        taskId: this.task()!.id,  // ✅ task() not task
        status
      });
      
      const task = this.task();
      if (task) {
        this.task.set({ ...task, status });
      }
    } catch (error: any) {
      console.error('Failed to update task:', error);
      this.error.set('Failed to update task');
    }
  }
    async editVoterStatus(voter: Voter) {
      // TODO: Implement voter status update
      console.log('Edit voter:', voter);
    }

    addNewMembers() {
      // TODO: Open modal to add new voters
      console.log('Add new members clicked');
      alert('Add New Members - Coming Soon!');
    }

    openMaps() {
      if (!this.task()?.location) return;
      const { lat, lng } = this.task()!.location!;
      const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
      window.open(mapsUrl, '_blank');
    }

  downloadTaskData() {
    if (!this.task()) return;  // ✅ task() not task
    
    const data = {
      task: this.task(),       // ✅ task() not task
      voters: this.voters(),
      exportedAt: new Date().toISOString()
    };
    
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `task-${this.task()!.id}.json`;  // ✅ task()!.id
    link.click();
  }

  async shareTask() {
    if (!this.task()) return;  // ✅ task()
    
    const taskUrl = `${window.location.origin}/tasks/${this.task()!.id}`;  // ✅ task()!.id
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: this.task()!.title,         // ✅ task()!
          text: this.task()!.description,    // ✅ task()!
          url: taskUrl
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      await navigator.clipboard.writeText(taskUrl);
    }
  }

  

    goBack() {
      this.router.navigate(['/tasks']);
    }
  }
