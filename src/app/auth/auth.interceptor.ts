// auth.interceptor.ts: attaches the Clerk session token to every HTTP request.
// Uses switchMap because getToken() is async (token may need refreshing).

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from, switchMap } from 'rxjs';
import { ClerkService } from '../services/clerk.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const clerkService = inject(ClerkService);

  return from(clerkService.getToken()).pipe(
    switchMap(token => {
      const request = token
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;

      return next(request);
    }),
  );
};
