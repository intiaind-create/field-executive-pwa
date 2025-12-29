import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { ConvexService } from './convex.service';
import { OfflineStorageService, OfflineAction } from './offline-storage.service';
import { api } from '@convex/_generated/api';

@Injectable({
  providedIn: 'root'
})
export class OfflineSyncService implements OnDestroy {
  private convex = inject(ConvexService);
  public offlineStorage = inject(OfflineStorageService);

  private readonly BATCH_SIZE = 10; // ✅ Process 10 at a time
  private readonly BATCH_DELAY = 100; // ✅ 100ms between batches

  isSyncing = signal(false);
  isOnline = signal(navigator.onLine);

  private onlineHandler = () => this.handleOnline();
  private offlineHandler = () => this.handleOffline();

  constructor() {
    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  ngOnDestroy() {
    window.removeEventListener('online', this.onlineHandler);
    window.removeEventListener('offline', this.offlineHandler);
  }

  private handleOnline() {
    console.log('🌐 Connection restored');
    this.isOnline.set(true);
    this.syncPendingActions();
  }

  private handleOffline() {
    console.log('📴 Connection lost');
    this.isOnline.set(false);
  }

  async syncPendingActions() {
    if (this.isSyncing()) return;
    if (!this.isOnline()) return;

    const queue = this.offlineStorage.getQueue();
    if (queue.length === 0) return;

    console.log(`🔄 Syncing ${queue.length} pending actions...`);
    this.isSyncing.set(true);

    try {
      // ✅ Process in batches
      for (let i = 0; i < queue.length; i += this.BATCH_SIZE) {
        const batch = queue.slice(i, i + this.BATCH_SIZE);
        
        await Promise.allSettled(
          batch.map(action => this.syncAction(action))
        );

        // Delay between batches
        if (i + this.BATCH_SIZE < queue.length) {
          await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY));
        }
      }

      console.log('✅ Sync complete');
    } catch (error) {
      console.error('❌ Sync failed:', error);
    } finally {
      this.isSyncing.set(false);
    }
  }

  private async syncAction(action: OfflineAction) {
    try {
      await this.processAction(action);
      this.offlineStorage.removeAction(action.id);
      console.log('✅ Synced:', action.type);
    } catch (error: any) {
      console.error('❌ Sync failed:', action.type, error);
      
      if (action.retryCount < 3) {
        this.offlineStorage.incrementRetry(action.id);
      } else {
        console.error('🚫 Max retries:', action.id);
        this.offlineStorage.removeAction(action.id);
      }
    }
  }

  private async processAction(action: OfflineAction) {
    switch (action.type) {
      case 'updateTaskStatus':
        return await this.convex.mutation(
          api.tasks.me.mutation.updateTaskStatus,
          action.payload
        );
      
      case 'startTask':
        return await this.convex.mutation(
          api.tasks.me.mutation.updateTaskStatus,
          {
            taskId: action.payload.taskId,
            status: 'in_progress'
          }
        );
      
      case 'completeTask':
        return await this.convex.mutation(
          api.tasks.me.mutation.updateTaskStatus,
          {
            taskId: action.payload.taskId,
            status: 'completed',
            notes: action.payload.notes,
            location: action.payload.location
          }
        );

         case 'trackLocation': // ✅ NEW
      return await this.convex.mutation(
        api.location.mutation.track,
        action.payload
      );
      
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  queueAction(type: string, payload: any): string {
    return this.offlineStorage.addAction(type as any, payload);
  }
}