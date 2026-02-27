import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { I18nService } from './i18n';
import { LangSelector } from './components/lang-selector/lang-selector';
import { AuthService } from './services/auth.service';
import { OnboardingComponent } from './components/onboarding/onboarding';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, LangSelector, OnboardingComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly showOnboarding = signal(
    this.auth.isLoggedIn() && !localStorage.getItem('herbia-onboarded')
  );

  constructor() {
    effect(() => {
      document.documentElement.lang = this.i18n.currentLang();
    });
  }

  protected onOnboardingDone(): void {
    localStorage.setItem('herbia-onboarded', 'true');
    this.showOnboarding.set(false);
  }
}
