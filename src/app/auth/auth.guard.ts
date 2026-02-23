// auth.guard.ts: prevents unauthenticated users from accessing protected pages
//
// Like @PreAuthorize("isAuthenticated()") on a Spring controller, but client-side
// Or like Spring Security's .requestMatchers("/route").authenticated()
//
// Functional guard (Angular 15+ pattern, replaces class-based CanActivate)

import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;  // Allow navigation
  }

  // Redirect to login page (like Spring Security's .formLogin().loginPage("/login"))
  return router.createUrlTree(['/login']);
};
