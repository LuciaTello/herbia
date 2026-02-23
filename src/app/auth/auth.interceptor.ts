// auth.interceptor.ts: automatically attaches JWT to every HTTP request
//
// Like a ClientHttpRequestInterceptor in Spring's RestTemplate:
//   restTemplate.getInterceptors().add((request, body, execution) -> {
//       request.getHeaders().setBearerAuth(token);
//       return execution.execute(request, body);
//   });
//
// Functional interceptor (Angular 15+ pattern, replaces class-based HttpInterceptor)

import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // If we have a token, clone the request and add the Authorization header
  // "Clone" because HTTP requests are immutable in Angular (like Java's immutable objects)
  if (token) {
    const authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
    return next(authReq);
  }

  // No token? Pass the request through unchanged (for login/register calls)
  return next(req);
};
