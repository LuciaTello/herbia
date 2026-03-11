// auth.guard.ts: blocks unauthenticated users from accessing protected pages.

import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { ClerkService } from '../services/clerk.service';

export const authGuard: CanActivateFn = () => {
  const clerkService = inject(ClerkService);
  const router = inject(Router);

  if (clerkService.clerk?.user) return true;
  return router.createUrlTree(['/login']);
};
