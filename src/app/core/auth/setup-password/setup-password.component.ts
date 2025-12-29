import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-setup-password',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './setup-password.component.html'
})
export class SetupPasswordComponent implements OnInit {
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
        console.log('✅ Token found in URL');
      } else {
        this.errorMessage.set('Invalid or missing setup token. Please contact your manager.');
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
      console.log('🔵 Setting up password...');
      
      const result: any = await this.authService.setupPassword(
        this.token(),
        this.password()
      );

      if (result.success) {
        this.successMessage.set('Password setup successful! Redirecting to login...');
        
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      } else {
        this.errorMessage.set(result.message || 'Failed to setup password');
      }

    } catch (error: any) {
      console.error('❌ Setup error:', error);
      this.errorMessage.set(error.message || 'Failed to setup password. The link may have expired.');
    } finally {
      this.isLoading.set(false);
    }
  }
}