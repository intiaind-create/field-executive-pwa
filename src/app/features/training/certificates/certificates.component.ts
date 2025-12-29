import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { ConvexService } from '../../../core/services/convex.service';
import { AuthService } from '../../../core/auth/services/auth.service';
import { api } from '@convex/_generated/api';

export interface Certificate {
  _id: string;
  courseId: string;
  courseTitle: string;
  courseCategory: string;
  completedAt: number;
  finalScore: number;
  certificateUrl: string | null;
}

@Component({
  selector: 'app-certificates',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 pb-32">
      
      <!-- Back Button -->
      <button routerLink="/training" 
              class="flex items-center text-blue-600 font-bold mb-4 hover:text-blue-700">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        Back to Training
      </button>

      <!-- Header -->
      <h1 class="text-3xl font-black text-gray-900 mb-6">🏆 My Certificates</h1>

      <!-- Loading -->
      <div *ngIf="isLoading()" class="flex items-center justify-center py-20">
        <div class="flex flex-col items-center space-y-4">
          <div class="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p class="text-gray-600 font-medium">Loading certificates...</p>
        </div>
      </div>

      <!-- Empty State -->
      <div *ngIf="!isLoading() && certificates().length === 0" class="text-center py-20">
        <div class="text-6xl mb-4">📜</div>
        <h3 class="text-2xl font-bold text-gray-900 mb-2">No Certificates Yet</h3>
        <p class="text-gray-600 mb-6">Complete courses to earn certificates</p>
        <button routerLink="/training" 
                class="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all">
          Browse Courses
        </button>
      </div>

      <!-- Certificates Grid -->
      <div *ngIf="!isLoading() && certificates().length > 0" class="space-y-4">
        
        <div *ngFor="let cert of certificates()" 
             class="bg-white rounded-2xl shadow-lg overflow-hidden">
          
          <div class="p-6">
            <div class="flex items-start justify-between mb-4">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-2">
                  <span class="px-3 py-1 bg-green-100 text-green-800 rounded-lg text-xs font-bold">
                    ✅ Completed
                  </span>
                  <span class="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-xs font-bold">
                    {{ cert.courseCategory }}
                  </span>
                </div>
                <h3 class="text-xl font-black text-gray-900 mb-2">{{ cert.courseTitle }}</h3>
                <div class="flex items-center gap-4 text-sm text-gray-600">
                  <span>Score: <strong class="text-green-600">{{ cert.finalScore }}%</strong></span>
                  <span>{{ cert.completedAt | date:'MMM d, yyyy' }}</span>
                </div>
              </div>
              <div class="text-5xl ml-4">🏆</div>
            </div>

            <button *ngIf="cert.certificateUrl"
                    (click)="viewCertificate(cert.certificateUrl!)"
                    class="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all">
              View Certificate
            </button>
            
            <div *ngIf="!cert.certificateUrl"
                 class="w-full px-4 py-3 bg-gray-100 text-gray-500 rounded-xl font-bold text-center">
              Certificate Generating...
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CertificatesComponent implements OnInit {
  private convex = inject(ConvexService);
  private authService = inject(AuthService);
  private router = inject(Router);

  certificates = signal<Certificate[]>([]);
  isLoading = signal(true);

  async ngOnInit() {
    await this.authService.waitForAuth();
    
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }

    await this.loadCertificates();
  }

  async loadCertificates() {
    this.isLoading.set(true);

    try {
      const certs = await this.convex.query<Certificate[]>(
        api.training.executive.queries.getMyCertificates,
        {}
      );

      this.certificates.set(certs);
      console.log('✅ Certificates loaded:', certs.length);
    } catch (error: any) {
      console.error('Failed to load certificates:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  viewCertificate(url: string) {
    window.open(url, '_blank');
  }
}