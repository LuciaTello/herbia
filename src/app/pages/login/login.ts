// LoginPage: multi-step auth flow using Clerk headless
// Step 1  : email input (bilingual — language not chosen yet)
// Step 2a : password → login via Clerk
// Step 2b : username + password + lang → Clerk sign-up + send OTP
// Step 3  : OTP verification → sync user to our DB

import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ClerkService } from '../../services/clerk.service';
import { I18nService } from '../../i18n';

// Bilingual constants — split ES/FR for cycling animation
const BILINGUAL = {
  subtitleEs: 'Dime adónde vas y te diré qué plantas encontrarás',
  subtitleFr: 'Dis-moi où tu vas et je te dirai quelles plantes tu trouveras',
  explanationEs: 'Introduce tu email para entrar o crear una cuenta',
  explanationFr: 'Entrez votre email pour vous connecter ou créer un compte',
  passwordPlaceholder: 'Contraseña / Mot de passe',
  next: 'Siguiente / Suivant',
  submitting: '...',
  chooseLang: 'Elige tu idioma / Choisis ta langue',
  otpPlaceholderEs: 'Código de verificación',
  otpPlaceholderFr: 'Code de vérification',
};

@Component({
  selector: 'app-login',
  imports: [FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginPage {
  private readonly authService = inject(AuthService);
  private readonly clerkService = inject(ClerkService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  protected readonly BI = BILINGUAL;
  protected readonly step = signal<'email' | 'login' | 'register' | 'otp'>('email');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly selectedLang = signal<'es' | 'fr'>('es');
  protected readonly username = signal('');
  protected readonly otpCode = signal('');
  protected readonly error = signal('');
  protected readonly loading = signal(false);
  protected readonly showPassword = signal(false);

  goBack(): void {
    this.step.set('email');
    this.password.set('');
    this.error.set('');
  }

  async onCheckEmail(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.authService.checkEmail(this.email());
      if (result.exists) {
        this.i18n.setLang(result.lang as 'es' | 'fr');
        this.step.set('login');
      } else {
        this.i18n.setLang(this.selectedLang());
        this.step.set('register');
      }
    } catch (e: any) {
      console.error('[login] checkEmail error:', e);
      const isTimeout = e?.name === 'TimeoutError' || e?.name === 'EmptyError';
      this.error.set(isTimeout
        ? this.i18n.t().login.serverSlow
        : `email-check: ${e?.status ?? e?.name ?? '?'} ${String(e?.error).slice(0,40)}`);
    } finally {
      this.loading.set(false);
    }
  }

  onLangPick(lang: 'es' | 'fr'): void {
    this.selectedLang.set(lang);
    this.i18n.setLang(lang);
  }

  async onLogin(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      // Re-init Clerk if it failed to load on app start
      if (!this.clerkService.clerk?.client) {
        console.log('[login] Clerk client not ready, re-initialising...');
        await this.clerkService.init();
      }
      console.log('[login] clerk.client:', !!this.clerkService.clerk?.client);
      const signIn = await this.clerkService.clerk.client!.signIn.create({
        identifier: this.email(),
        password: this.password(),
      });
      if (signIn.status === 'complete') {
        await this.clerkService.clerk.setActive({ session: signIn.createdSessionId });
        this.clerkService.user.set(this.clerkService.clerk.user);
        await this.authService.refreshProfile();
        this.router.navigate(['/']);
      } else {
        this.error.set(this.i18n.t().login.genericError);
      }
    } catch (e: any) {
      console.error('[login] onLogin error:', e);
      this.error.set(e?.errors?.[0]?.message || `signin: ${e?.status ?? e?.name ?? '?'} ${String(e?.message ?? e?.error).slice(0,40)}`);
    } finally {
      this.loading.set(false);
    }
  }

  async onRegister(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.clerkService.clerk.client!.signUp.create({
        emailAddress: this.email(),
        password: this.password(),
      });
      // Use the live clerk.client.signUp reference for OTP — always up to date
      await this.clerkService.clerk.client!.signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      this.step.set('otp');
    } catch (e: any) {
      console.error('Register error:', e);
      this.error.set(e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || this.i18n.t().login.genericError);
    } finally {
      this.loading.set(false);
    }
  }

  async onVerifyOtp(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      // Always use the live clerk.client.signUp (not a stored stale reference)
      const result = await this.clerkService.clerk.client!.signUp.attemptEmailAddressVerification({
        code: this.otpCode(),
      });
      console.log('OTP result status:', result.status);
      if (result.status === 'complete') {
        await this.clerkService.clerk.setActive({ session: result.createdSessionId });
        this.clerkService.user.set(this.clerkService.clerk.user);
        await this.authService.syncAfterRegister(this.selectedLang(), this.username().trim() || undefined);
        this.router.navigate(['/']);
      } else {
        console.error('OTP incomplete, status:', result.status, result);
        this.error.set(`Status: ${result.status}`);
      }
    } catch (e: any) {
      console.error('OTP error:', e);
      this.error.set(e?.errors?.[0]?.longMessage || e?.errors?.[0]?.message || this.i18n.t().login.genericError);
    } finally {
      this.loading.set(false);
    }
  }
}
