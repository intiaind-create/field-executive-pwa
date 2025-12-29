import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = async (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  console.log('🔐 Auth Guard: Checking authentication...');

  // ✅ Event-driven wait (no polling)
  await authService.waitForAuth();

  if (authService.isAuthenticated()) {
    console.log('✅ Auth Guard: Authenticated, allowing access');
    return true;
  }

  console.log('❌ Auth Guard: Not authenticated, redirecting to login');
  
  // Store the attempted URL for redirecting after login
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  });
};