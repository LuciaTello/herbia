import { Component, computed, effect, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { I18nService } from './i18n';
import { AuthService } from './services/auth.service';
import { OnboardingComponent } from './components/onboarding/onboarding';

const LEVEL_THRESHOLDS = [0, 10, 30, 60, 100, 200];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, OnboardingComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly showOnboarding = computed(() => this.auth.justRegistered());

  protected readonly levelEmoji = computed(() => {
    const pts = this.auth.points();
    const levels = this.i18n.t().level.levels;
    let idx = 0;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (pts >= LEVEL_THRESHOLDS[i]) { idx = i; break; }
    }
    return levels[idx]?.emoji ?? '🌱';
  });

  constructor() {
    effect(() => {
      document.documentElement.lang = this.i18n.currentLang();
    });
  }

  protected onOnboardingDone(): void {
    this.auth.justRegistered.set(false);
  }
}
