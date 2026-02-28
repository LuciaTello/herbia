// LoginPage: multi-step auth flow
// Step 1: email input (bilingual ES/FR — language not chosen yet)
// Step 2a: password (login) — in user's saved language
// Step 2b: password + language picker (register) — in selected language

import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../i18n';

// Only the first step is bilingual (before we know the user's language)
const BILINGUAL = {
  title: 'herbia',
  subtitle: 'Dime adónde vas y te diré qué plantas encontrarás\nDis-moi où tu vas et je te dirai quelles plantes tu trouveras',
  explanation: 'Introduce tu email para entrar o crear una cuenta\nEntrez votre email pour vous connecter ou créer un compte',
  next: 'Siguiente / Suivant',
  submitting: '...',
  chooseLang: 'Elige tu idioma / Choisis ta langue',
};

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

  protected readonly BI = BILINGUAL;
  protected readonly step = signal<'email' | 'login' | 'register'>('email');
  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly selectedLang = signal<'es' | 'fr'>('es');
  protected readonly error = signal('');
  protected readonly loading = signal(false);

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
        // Set i18n to the user's saved language for the login step
        this.i18n.setLang(result.lang as 'es' | 'fr');
        this.step.set('login');
      } else {
        // For register, default to 'es' — user will pick
        this.i18n.setLang(this.selectedLang());
        this.step.set('register');
      }
    } catch {
      this.error.set('Error');
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
      await this.authService.login(this.email(), this.password());
      this.router.navigate(['/']);
    } catch (e: any) {
      this.error.set(e?.error?.error || this.i18n.t().login.genericError);
    } finally {
      this.loading.set(false);
    }
  }

  async onRegister(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      await this.authService.register(this.email(), this.password(), this.selectedLang());
      this.router.navigate(['/']);
    } catch (e: any) {
      this.error.set(e?.error?.error || this.i18n.t().login.genericError);
    } finally {
      this.loading.set(false);
    }
  }
}
