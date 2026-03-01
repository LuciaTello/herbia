import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../i18n';
import { AuthService } from '../../services/auth.service';

const LEVEL_THRESHOLDS = [0, 750, 1500, 3750, 7500, 25000];

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomePage {
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);

  protected readonly levelEmoji = computed(() => {
    const pts = this.auth.points();
    const levels = this.i18n.t().level.levels;
    let idx = 0;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (pts >= LEVEL_THRESHOLDS[i]) { idx = i; break; }
    }
    return levels[idx]?.emoji ?? '🌱';
  });
}
