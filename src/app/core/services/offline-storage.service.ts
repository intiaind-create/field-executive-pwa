import { Injectable, signal } from '@angular/core';

export interface OfflineAction {
  id: string;
  type: 'updateTaskStatus' | 'startTask' | 'completeTask'|'trackLocation';
  payload: any;
  timestamp: number;
  retryCount: number;
}

@Injectable({
  providedIn: 'root'
})
export class OfflineStorageService {
  private readonly OFFLINE_QUEUE_KEY = 'offline_actions_queue';
  private readonly MAX_QUEUE_SIZE = 500; // ✅ Limit queue size
  
  pendingActionsCount = signal(0);

  addAction(type: OfflineAction['type'], payload: any): string {
    const queue = this.getQueue();
    
    // ✅ Size limit check
    if (queue.length >= this.MAX_QUEUE_SIZE) {
      console.warn('⚠️ Queue full, removing oldest action');
      queue.shift();
    }

    const action: OfflineAction = {
      id: crypto.randomUUID(),
      type,
      payload,
      timestamp: Date.now(),
      retryCount: 0
    };

    queue.push(action);
    this.saveQueue(queue);
    this.updatePendingCount();

    console.log('📥 Queued:', action.type);
    return action.id;
  }

  getQueue(): OfflineAction[] {
    try {
      const stored = localStorage.getItem(this.OFFLINE_QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('❌ Failed to parse queue:', error);
      return [];
    }
  }

  private saveQueue(queue: OfflineAction[]): void {
    try {
      localStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('❌ Failed to save queue:', error);
      // ✅ Handle quota exceeded
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        // Remove oldest half of queue
        const reducedQueue = queue.slice(Math.floor(queue.length / 2));
        localStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(reducedQueue));
      }
    }
  }

  removeAction(actionId: string): void {
    const queue = this.getQueue().filter(a => a.id !== actionId);
    this.saveQueue(queue);
    this.updatePendingCount();
  }

  incrementRetry(actionId: string): void {
    const queue = this.getQueue();
    const action = queue.find(a => a.id === actionId);
    if (action) {
      action.retryCount++;
      this.saveQueue(queue);
    }
  }

  clearQueue(): void {
    localStorage.removeItem(this.OFFLINE_QUEUE_KEY);
    this.updatePendingCount();
  }

  private updatePendingCount(): void {
    this.pendingActionsCount.set(this.getQueue().length);
  }
}