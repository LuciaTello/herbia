import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '../../i18n';
import { AuthService } from '../../services/auth.service';
import { FriendService } from '../../services/friend.service';
import { ConnectivityService } from '../../services/connectivity.service';
import { OfflineQueueService } from '../../services/offline-queue.service';

const LEVEL_THRESHOLDS = [0, 750, 1500, 3750, 7500, 25000];

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomePage implements OnInit {
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);
  protected readonly friendService = inject(FriendService);
  protected readonly connectivity = inject(ConnectivityService);
  protected readonly offlineQueue = inject(OfflineQueueService);
  private readonly router = inject(Router);
  protected readonly showQuizPopup = signal(false);

  async ngOnInit(): Promise<void> {
    // If profile was not yet loaded by the background init, load it now
    if (!this.auth.profileLoaded()) {
      await this.auth.refreshProfile().catch(() => {});
    }
    if (this.auth.quizUnlocked() && !this.auth.quizPopupShown()) {
      this.showQuizPopup.set(true);
    }
  }

  protected dismissQuizPopup(): void {
    this.showQuizPopup.set(false);
    this.auth.dismissQuizPopup().catch(() => {});
  }

  protected async toggleOfflineMode(): Promise<void> {
    const goingOnline = this.connectivity.manualOfflineMode();
    await this.connectivity.setManualOffline(!goingOnline);
    if (goingOnline && this.offlineQueue.pendingCount() > 0) {
      this.router.navigate(['/sync']);
    }
  }

  protected readonly currentLevel = computed(() => {
    const pts = this.auth.points();
    let idx = 0;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (pts >= LEVEL_THRESHOLDS[i]) { idx = i; break; }
    }
    return idx;
  });

  protected readonly levelEmoji = computed(() => {
    return this.i18n.t().level.levels[this.currentLevel()]?.emoji ?? '🌱';
  });

  protected readonly nextThreshold = computed(() => {
    const idx = this.currentLevel();
    return idx < LEVEL_THRESHOLDS.length - 1 ? LEVEL_THRESHOLDS[idx + 1] : null;
  });

  protected readonly progressPercent = computed(() => {
    const idx = this.currentLevel();
    const pts = this.auth.points();
    const current = LEVEL_THRESHOLDS[idx];
    const next = this.nextThreshold();
    if (!next) return 100;
    return Math.round(((pts - current) / (next - current)) * 100);
  });

  protected readonly nextLevel = computed(() => {
    const next = this.nextThreshold();
    if (!next) return null;
    const remaining = next - this.auth.points();
    return this.i18n.t().level.nextLevel(remaining);
  });
}
