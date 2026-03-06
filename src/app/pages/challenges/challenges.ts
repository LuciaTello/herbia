import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../i18n';
import { AuthService } from '../../services/auth.service';
import { ChallengeService } from '../../services/challenge.service';
import { QuizGameComponent } from '../../components/quiz-game/quiz-game';

@Component({
  selector: 'app-challenges',
  imports: [RouterLink, QuizGameComponent],
  templateUrl: './challenges.html',
  styleUrl: './challenges.css',
})
export class ChallengesPage implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  protected readonly challenge = inject(ChallengeService);

  protected readonly playing = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly isUnlocked = computed(() => this.auth.quizUnlocked());
  protected readonly quizReady = computed(() => this.challenge.quizPlants().length >= 10);

  async ngOnInit(): Promise<void> {
    await Promise.all([
      this.auth.refreshProfile(),
      this.challenge.loadQuizPlants(),
    ]);
    this.loading.set(false);
  }

  protected async startQuiz(): Promise<void> {
    this.error.set(null);
    this.loading.set(true);
    try {
      const ok = await this.challenge.generateQuiz();
      if (ok) {
        this.playing.set(true);
      } else {
        this.error.set(this.i18n.t().challenges.notEnoughPhotos);
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected onQuizDone(): void {
    this.playing.set(false);
  }
}
