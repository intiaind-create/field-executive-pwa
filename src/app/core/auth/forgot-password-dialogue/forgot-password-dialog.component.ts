import { Component, inject, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/auth/services/auth.service';

@Component({
  selector: 'app-forgot-password-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './forgot-password-dialog.component.html'
})
export class ForgotPasswordDialogComponent {
  private authService = inject(AuthService);
  
  close = output<void>();
  
  email = signal('');
  isLoading = signal(false);
  successMessage = signal('');
  errorMessage = signal('');

  async handleSubmit() {
    if (!this.email() || !this.email().includes('@')) {
      this.errorMessage.set('Please enter a valid email address');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      console.log('🔵 Requesting password reset for:', this.email());
      
      const result = await this.authService.requestPasswordReset(this.email());
      
      console.log('🟢 Reset result:', result);

      this.successMessage.set('Password reset link sent! Check your email (including spam folder).');
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        this.close.emit();
      }, 3000);

    } catch (error: any) {
      console.error('🔴 Reset request failed:', error);
      this.errorMessage.set(error.message || 'Failed to send reset link. Please try again.');
    } finally {
      this.isLoading.set(false);
    }
  }

  handleClose() {
    this.close.emit();
  }
}