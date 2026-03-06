import { Component, computed, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { I18nService } from './i18n';
import { AuthService } from './services/auth.service';
import { OnboardingComponent } from './components/onboarding/onboarding';
import { ConnectivityService } from './services/connectivity.service';
import { OfflineQueueService } from './services/offline-queue.service';

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
  private readonly offlineQueue = inject(OfflineQueueService);
  protected readonly showOnboarding = computed(() => this.auth.justRegistered());
  protected readonly syncMessage = this.offlineQueue.syncMessage;

  constructor() {
    effect(() => {
      document.documentElement.lang = this.i18n.currentLang();
    });
  }

  protected onOnboardingDone(): void {
    this.auth.justRegistered.set(false);
  }
}
