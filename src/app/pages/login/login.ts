// LoginPage: handles both login and registration in a single component
// Uses a signal (isRegisterMode) to toggle between the two forms
// Same patterns as RoutePage: FormsModule, ngModel, signals, i18n

import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../i18n';

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  // Form fields (same signal pattern as RoutePage's origin/destination)
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly error = signal('');
  protected readonly loading = signal(false);

  // Toggle: false = login mode, true = register mode
  protected readonly isRegisterMode = signal(false);

  toggleMode(): void {
    this.isRegisterMode.update(v => !v);
    this.error.set('');
  }

  async onSubmit(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      if (this.isRegisterMode()) {
        await this.authService.register(this.email(), this.password());
      } else {
        await this.authService.login(this.email(), this.password());
      }
      // After successful login/register, navigate to home
      this.router.navigate(['/']);
    } catch (e: any) {
      // HttpErrorResponse has the backend error in e.error.error
      const message = e?.error?.error || this.i18n.t().login.genericError;
      this.error.set(message);
    } finally {
      this.loading.set(false);
    }
  }
}
