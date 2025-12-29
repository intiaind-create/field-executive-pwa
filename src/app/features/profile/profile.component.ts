import { Component, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConvexService } from '../../core/services/convex.service';
import { api } from '@convex/_generated/api';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '@/core/auth/services/auth.service';

export interface ExecutiveProfile {
  _id: string;
  name?: string;
  email?: string;
  phone?: string;
  employeeId?: string;
  department?: string;
  designation?: string;
  convexId?: string;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
})

export class ProfileComponent {
  private convex = inject(ConvexService);
  public auth = inject(AuthService);

  // 1. DATA: Points to 'getCurrentExecutive' in your queries.ts
executiveData = toSignal<ExecutiveProfile | null | undefined>(
    this.convex.watch(api.executives.queries.getCurrentExecutive), 
    { initialValue: undefined } // undefined means "loading"
  );

  isEditing = signal(false);
  isSubmitting = signal(false);

  formData = signal({
    employeeId: '',
    name: '',
    email: '',
    phone: '',
    department: '',
    designation: '',
  });

  constructor() {
    // 2. AUTO-FILL
    effect(() => {
      const data = this.executiveData();
      if (data) {
        this.formData.set({
          employeeId: data.employeeId || '',
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          department: data.department || '',
          designation: data.designation || '',
        });
      }
    });
  }

  async saveProfile() {
    this.isSubmitting.set(true);
    try {
      const data = this.formData();
      const current = this.executiveData();

      // 3. LOGIC: Use 'createSelf' or 'updateSelf' based on your backend exports
      
      if (!current) {
        // MATCHES: export const createSelf = mutation(...)
        await this.convex.mutation(api.executives.mutation.createSelf, {
          name: data.name,
          email: data.email,
          phone: data.phone,
          employeeId: data.employeeId,
          department: data.department,
          designation: data.designation
        });
      } else {
        // MATCHES: export const updateSelf = mutation(...)
        await this.convex.mutation(api.executives.mutation.updateSelf, {
          name: data.name,
          phone: data.phone,
          department: data.department,
          designation: data.designation
        });
      }

      this.isEditing.set(false);
    } catch (err: any) {
      console.error('Profile save failed', err);
      const msg = err.message.includes('No pre-registered account') 
        ? 'No account found for this email. Contact your Admin.' 
        : 'Failed to save profile. Please try again.';
      alert(msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  logout() {
    this.auth.logout();
  }
}   