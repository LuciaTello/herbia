import { ApplicationConfig, APP_INITIALIZER, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './auth/auth.interceptor';
import { ClerkService } from './services/clerk.service';
import { AuthService } from './services/auth.service';
import { ConnectivityService } from './services/connectivity.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    {
      provide: APP_INITIALIZER,
      useFactory: () => {
        const clerkService = inject(ClerkService);
        const authService = inject(AuthService);
        const connectivityService = inject(ConnectivityService);
        return async () => {
          await clerkService.init();
          await authService.init();
          await connectivityService.initManualMode();
        };
      },
      multi: true,
    },
  ]
};
