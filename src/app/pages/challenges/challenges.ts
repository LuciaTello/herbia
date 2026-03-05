import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../i18n';
import { CollectionService } from '../../services/collection.service';
import { ChallengeService } from '../../services/challenge.service';
import { QuizGameComponent } from '../../components/quiz-game/quiz-game';

const MIN_PLANTS = 20;

@Component({
  selector: 'app-challenges',
  imports: [RouterLink, QuizGameComponent],
  templateUrl: './challenges.html',
  styleUrl: './challenges.css',
})
export class ChallengesPage implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly collection = inject(CollectionService);
  private readonly challenge = inject(ChallengeService);

  protected readonly playing = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly plantCount = computed(() => this.collection.getCollection()().length);
  protected readonly isUnlocked = computed(() => this.plantCount() >= MIN_PLANTS);
  protected readonly plantsNeeded = computed(() => Math.max(0, MIN_PLANTS - this.plantCount()));

  async ngOnInit(): Promise<void> {
    await this.collection.loadCollection();
    this.loading.set(false);
  }

  protected startQuiz(): void {
    this.error.set(null);
    const ok = this.challenge.generateQuiz(this.collection.getCollection()());
    if (ok) {
      this.playing.set(true);
    } else {
      this.error.set(this.i18n.t().challenges.notEnoughPhotos);
    }
  }

  protected onQuizDone(): void {
    this.playing.set(false);
  }
}
