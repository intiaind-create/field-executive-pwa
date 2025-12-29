// executive-app/src/app/core/services/convex.service.ts
import { Injectable } from '@angular/core';
import { ConvexClient } from 'convex/browser';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({ providedIn: 'root' })
export class ConvexService {
  // ✅ Single instance, created once
  public readonly client: ConvexClient;

  constructor() {
    console.log('🔧 ConvexService: Initializing single client instance');
    this.client = new ConvexClient(environment.convexUrl);
    
    // ✅ Initialize with token if exists
    const token = localStorage.getItem('convex_session_token');
    if (token) {
      console.log('🔑 ConvexService: Found token, setting auth');
      this.client.setAuth(async () => token);
    }
  }

  async query<T>(query: any, args?: any): Promise<T> {
    return await this.client.query(query, args);
  }

  async mutation<T>(mutation: any, args?: any): Promise<T> {
    return await this.client.mutation(mutation, args);
  }

  async action<T>(action: any, args?: any): Promise<T> {
    return await this.client.action(action, args);
  }

  // ✅ Helper to set/clear auth
  setAuth(token: string | null) {
    if (token) {
      console.log('🔑 ConvexService: Setting auth token');
      this.client.setAuth(async () => token);
      localStorage.setItem('convex_session_token', token);
    } else {
      console.log('🧹 ConvexService: Clearing auth token');
      this.client.setAuth(async () => undefined);
      localStorage.removeItem('convex_session_token');
    }
  }

  clearAuth() {
    console.log('🧹 ConvexService: Clearing auth');
    this.client.setAuth(async () => undefined);
    localStorage.removeItem('convex_session_token');
  }

 watch<T>(query: any, args?: any): Observable<T> {
    return new Observable<T>((subscriber) => {
      // Subscribe to Convex query changes
      const unsubscribe = this.client.onUpdate(query, args, (result: T) => {
        subscriber.next(result);
      });

      // Cleanup function
      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    });
  }
}