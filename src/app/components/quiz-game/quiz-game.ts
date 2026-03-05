import { Component, computed, inject, output } from '@angular/core';
import { I18nService } from '../../i18n';
import { ChallengeService } from '../../services/challenge.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-quiz-game',
  templateUrl: './quiz-game.html',
  styleUrl: './quiz-game.css',
})
export class QuizGameComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly quiz = inject(ChallengeService);
  private readonly auth = inject(AuthService);

  readonly done = output<void>();

  protected submitted = false;

  protected readonly currentQuestion = computed(() => {
    return this.quiz.questions()[this.quiz.currentIndex()];
  });

  protected readonly progress = computed(() => {
    return ((this.quiz.currentIndex() + 1) / this.quiz.questions().length) * 100;
  });

  protected readonly resultEmoji = computed(() => {
    const s = this.quiz.score();
    if (s === 10) return '🏆';
    if (s >= 7) return '🌟';
    if (s >= 4) return '🌿';
    return '🌱';
  });

  protected readonly resultMessage = computed(() => {
    const s = this.quiz.score();
    const t = this.i18n.t().challenges;
    if (s === 10) return t.resultsPerfect;
    if (s >= 7) return t.resultsGreat;
    if (s >= 4) return t.resultsGood;
    return t.resultsTryAgain;
  });

  protected selectOption(index: number): void {
    this.quiz.answer(index);
  }

  protected next(): void {
    this.quiz.nextQuestion();
    if (this.quiz.finished() && !this.submitted) {
      this.submitScore();
    }
  }

  protected playAgain(): void {
    this.done.emit();
  }

  protected backToHub(): void {
    this.done.emit();
  }

  private async submitScore(): Promise<void> {
    this.submitted = true;
    await this.quiz.submitScore();
    await this.auth.refreshProfile();
  }
}
