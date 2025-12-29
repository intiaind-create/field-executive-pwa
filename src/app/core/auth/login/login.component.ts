import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { ForgotPasswordDialogComponent } from '../forgot-password-dialogue/forgot-password-dialog.component';
import { ConvexService } from '@/core/services/convex.service';
import { api } from '@convex/_generated/api';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule,ForgotPasswordDialogComponent],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private convex=inject(ConvexService)
  isLoading = signal(false);
  // Form State
  email = signal('');
  password = signal('');
  flow = signal<'signIn' | 'signUp'>('signIn');
  isSubmitting = signal(false);
  errorMessage = signal('');
  showForgotDialog = signal(false);
  errorMsg = signal('');
  private auth = inject(AuthService);
  async handleSubmit() {
    this.isSubmitting.set(true);
    this.errorMessage.set('');

    const formData = new FormData();
    formData.append('email', this.email());
    formData.append('password', this.password());
    formData.append('flow', this.flow());

    const result = await this.authService.login(formData);

    if (!result.success) {
      this.errorMessage.set(result.error || 'Authentication failed');
    }
    
    this.isSubmitting.set(false);
  }
async handleLogin() {
    if (!this.email() || !this.password()) {
      this.errorMsg.set('Please enter both email and password');
      return;
    }

    this.isLoading.set(true);
    this.errorMsg.set('');

    try {
      const formData = new FormData();
      formData.append('email', this.email());
      formData.append('password', this.password());
      formData.append('flow', 'signIn');

      const result = await this.authService.login(formData);

      if (!result.success) {
        this.errorMsg.set(result.error || 'Login failed. Please try again.');
      }
      // Success - router.navigate is handled in authService.login()
      
    } catch (error: any) {
      console.error('Login error:', error);
      this.errorMsg.set(error.message || 'An unexpected error occurred');
    } finally {
      this.isLoading.set(false);
    }
  }
}
  