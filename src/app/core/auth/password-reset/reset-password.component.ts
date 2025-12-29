import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './reset-password.component.html'
})
export class ResetPasswordComponent implements OnInit {
  private authService = inject(AuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  token = signal('');
  password = signal('');
  confirmPassword = signal('');
  isLoading = signal(false);
  successMessage = signal('');
  errorMessage = signal('');
  showPassword = signal(false);
  showConfirmPassword = signal(false);

  ngOnInit() {
    // Get token from URL query params
    this.route.queryParams.subscribe(params => {
      if (params['token']) {
        this.token.set(params['token']);
      } else {
        this.errorMessage.set('Invalid or missing reset token');
      }
    });
  }

  async handleSubmit() {
    this.errorMessage.set('');
    this.successMessage.set('');

    // Validation
    if (this.password().length < 8) {
      this.errorMessage.set('Password must be at least 8 characters');
      return;
    }

    if (this.password() !== this.confirmPassword()) {
      this.errorMessage.set('Passwords do not match');
      return;
    }

    this.isLoading.set(true);

    try {
      const result: any = await this.authService.confirmPasswordReset(
        this.token(),
        this.password()
      );

      if (result.success) {
        this.successMessage.set('Password reset successful! Redirecting to login...');
        
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      } else {
        this.errorMessage.set(result.message || 'Failed to reset password');
      }

    } catch (error: any) {
      console.error('Reset error:', error);
      this.errorMessage.set(error.message || 'Failed to reset password. The link may have expired.');
    } finally {
      this.isLoading.set(false);
    }
  }
}