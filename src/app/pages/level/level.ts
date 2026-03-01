import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../i18n';

const LEVEL_THRESHOLDS = [0, 750, 1500, 3750, 7500, 25000];

@Component({
  selector: 'app-level',
  imports: [RouterLink],
  templateUrl: './level.html',
  styleUrl: './level.css',
})
export class LevelPage implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  protected readonly currentLevel = computed(() => {
    const pts = this.auth.points();
    let idx = 0;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (pts >= LEVEL_THRESHOLDS[i]) { idx = i; break; }
    }
    return idx;
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

  async ngOnInit(): Promise<void> {
    await this.auth.refreshProfile();
  }
}
