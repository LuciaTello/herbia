import { Component, computed, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { I18nService } from './i18n';
import { AuthService } from './services/auth.service';
import { OnboardingComponent } from './components/onboarding/onboarding';
import { ConnectivityService } from './services/connectivity.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, OnboardingComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly connectivity = inject(ConnectivityService);
  protected readonly showOnboarding = computed(() => this.auth.justRegistered());

  constructor() {
    effect(() => {
      document.documentElement.lang = this.i18n.currentLang();
    });
  }

  protected onOnboardingDone(): void {
    this.auth.justRegistered.set(false);
  }
}
