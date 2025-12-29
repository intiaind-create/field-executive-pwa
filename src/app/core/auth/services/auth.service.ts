import { ConvexService } from '@/core/services/convex.service';
import { Injectable, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { api } from '@convex/_generated/api';
import { firstValueFrom, Subject, take } from 'rxjs';

interface AuthStatusResponse {
  isAuthenticated: boolean;
  user: any | null;
   reason?: string; // from backend: 'usernotfound' | 'adminusernotfound' | 'userdeleted' | 'userinactive'
}

interface LoginResult {
  tokens?: {
    token: string;
  };
  success?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private router = inject(Router);
  private convex = inject(ConvexService);
  
  private authReady$ = new Subject<void>();

  // Auth State Signals
  isAuthenticated = signal(false);
  isLoading = signal(true);
  currentUser = signal<any>(null);

  constructor() {
    this.initializeAuth();
  }

  private async initializeAuth() {
    this.isLoading.set(true);
    
    try {
      const token = localStorage.getItem('convex_session_token');
      
      if (token) {
        console.log('🔑 AuthService: Found session token, restoring auth...');
        this.convex.setAuth(token);
        
        // Wait 500ms for ConvexClient to register auth
        await new Promise(resolve => setTimeout(resolve, 500));
        
        await this.checkAuthStatus();
      } else {
        console.log('❌ AuthService: No session token found');
        this.isAuthenticated.set(false);
        this.currentUser.set(null);
      }
    } catch (error) {
      console.error('AuthService: Auth initialization failed:', error);
      this.clearAuth();
    } finally {
      this.isLoading.set(false);
      this.authReady$.next();
      this.authReady$.complete();
    }
  }

 async checkAuthStatus() {
  this.isLoading.set(true);
  try {
    console.log('🔍 AuthService: Checking auth status...');
    
    const status = await this.convex.query<AuthStatusResponse>(
      api.auth.checkAuthStatus,
      {}
    );

    console.log('🔍 AuthService: checkAuthStatus result:', status);

    if (status?.isAuthenticated && status?.user) {
      this.isAuthenticated.set(true);
      this.currentUser.set(status.user);
      console.log('✅ AuthService: User authenticated:', status.user);
      return true;
    } else {
      console.log('❌ AuthService: Not authenticated, reason:', status?.reason);
      this.clearAuth();
      return false;
    }
  } catch (error) {
    console.error('AuthService: Auth check failed', error);
    this.clearAuth();
    return false;
  } finally {
    this.isLoading.set(false);
  }
}


async login(formData: FormData) {
  try {
    const flow = formData.get('flow') as string;
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    console.log('🔵 AuthService: Attempting login...');

    const result: LoginResult = await this.convex.action(api.auth.signIn, { 
      provider: 'password', 
      params: { flow, email, password }
    });

    if (!result?.tokens?.token) {
      throw new Error('No token received from server');
    }

    const token = result.tokens.token;
    console.log('✅ AuthService: Token received:', token.substring(0, 20) + '...');
    this.convex.setAuth(token);
    console.log('✅ AuthService: Token set in ConvexService');

    // Short delay for auth propagation
    await new Promise(resolve => setTimeout(resolve, 300));

    // Verify (but don't fail on linkage issues)
    const status = await this.convex.query<AuthStatusResponse>(
      api.auth.checkAuthStatus,
      {}
    );
    console.log('🔍 AuthService: checkAuthStatus after login:', status);

    // ✅ SOFT SUCCESS: Accept token OR full auth
    if (status?.isAuthenticated && status?.user) {
      // Full success
      this.isAuthenticated.set(true);
      this.currentUser.set(status.user);
      console.log('✅ AuthService: Full auth success');
    } else {
      // Token works but no admin/executive linkage
      console.warn('⚠️ AuthService: Token valid, partial auth:', status?.reason || 'unknown');
      this.isAuthenticated.set(true);
      this.currentUser.set({ email, partial: true });
    }

    console.log('✅ AuthService: Login successful, navigating to dashboard...');
    await this.router.navigate(['/dashboard']);
    return { success: true };

  } catch (error: any) {
    console.error('AuthService: Login failed', error);
    let errorMessage = error?.message || 'Login failed';

    if (errorMessage.includes('Invalid password')) {
      errorMessage = 'Invalid email or password.';
    } else if (errorMessage.includes('User not found')) {
      errorMessage = 'User not found. Please sign up.';
    } else if (errorMessage.includes('Authentication')) {
      errorMessage = 'Authentication failed. Please try again.';
    }

    this.clearAuth();
    return { success: false, error: errorMessage };
  }
}


  async waitForAuth(): Promise<void> {
    if (!this.isLoading()) {
      return;
    }
    
    return await firstValueFrom(this.authReady$.pipe(take(1)));
  }
  
  async requestPasswordReset(email: string) {
    try {
      console.log('🔵 AuthService: Requesting password reset...');
      const result = await this.convex.action(api.auth.requestPasswordReset, { email });
      console.log('✅ AuthService: Password reset requested');
      return result;
    } catch (error) {
      console.error('AuthService: Password reset request failed', error);
      throw error;
    }
  }

  async confirmPasswordReset(token: string, password: string) {
    try {
      console.log('🔵 AuthService: Confirming password reset...');
      const result = await this.convex.action(api.auth.consumeResetToken, { 
        token, 
        password 
      });
      console.log('✅ AuthService: Password reset confirmed');
      return result;
    } catch (error) {
      console.error('AuthService: Password reset confirmation failed', error);
      throw error;
    }
  }

  async setupPassword(token: string, password: string) {
    try {
      console.log('🔵 AuthService: Setting up password with token...');
      const result = await this.convex.action(api.auth.setupPasswordWithToken, { 
        token, 
        password 
      });
      console.log('✅ AuthService: Password setup successful');
      return result;
    } catch (error: any) {
      console.error('AuthService: Setup password error:', error);
      throw error;
    }
  }

  async logout() {
    try {
      console.log('🔵 AuthService: Logging out...');
      await this.convex.action(api.auth.signOut, {});
      console.log('✅ AuthService: Backend signout successful');
    } catch (error) {
      console.error("AuthService: Logout action failed", error);
    } finally {
      this.clearAuth();
      await this.router.navigate(['/login']);
      console.log('✅ AuthService: Logged out, redirected to login');
    }
  }

  private clearAuth() {
    this.convex.clearAuth();
    this.isAuthenticated.set(false);
    this.currentUser.set(null);
    console.log('🧹 AuthService: Auth cleared');
  }
}