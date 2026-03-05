import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SuggestedPlant } from '../models/plant.model';
import { environment } from '../../environments/environment';

export interface QuizQuestion {
  photo: string;
  plantName: string;
  type: 'name' | 'family';
  options: string[];
  correctIndex: number;
}

@Injectable({ providedIn: 'root' })
export class ChallengeService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/challenges`;

  readonly questions = signal<QuizQuestion[]>([]);
  readonly currentIndex = signal(0);
  readonly score = signal(0);
  readonly answered = signal<number | null>(null); // index chosen, null = not yet answered
  readonly finished = signal(false);

  /** Generate 10 quiz questions from the user's collection */
  generateQuiz(collection: SuggestedPlant[]): boolean {
    // Filter: need a name and at least one photo
    const eligible = collection.filter(p =>
      p.commonName && p.photos.length > 0
    );

    if (eligible.length < 10) return false;

    // Unique families for family-type questions
    const families = new Set(eligible.filter(p => p.family).map(p => p.family!));
    const canAskFamily = families.size >= 4;

    // Pick 10 random plants
    const shuffled = [...eligible].sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, 10);

    const questions: QuizQuestion[] = picked.map(plant => {
      // Choose question type: name or family (family only if enough families)
      const askFamily = canAskFamily && plant.family && Math.random() < 0.35;

      if (askFamily) {
        return this.buildFamilyQuestion(plant, eligible);
      }
      return this.buildNameQuestion(plant, eligible);
    });

    this.questions.set(questions);
    this.currentIndex.set(0);
    this.score.set(0);
    this.answered.set(null);
    this.finished.set(false);
    return true;
  }

  answer(optionIndex: number): void {
    if (this.answered() !== null) return; // already answered
    this.answered.set(optionIndex);
    const q = this.questions()[this.currentIndex()];
    if (optionIndex === q.correctIndex) {
      this.score.update(s => s + 1);
    }
  }

  nextQuestion(): void {
    const next = this.currentIndex() + 1;
    if (next >= this.questions().length) {
      this.finished.set(true);
    } else {
      this.currentIndex.set(next);
      this.answered.set(null);
    }
  }

  async submitScore(): Promise<number> {
    const result = await firstValueFrom(
      this.http.post<{ points: number }>(`${this.apiUrl}/quiz-result`, { score: this.score() })
    );
    return result.points;
  }

  private formatName(plant: SuggestedPlant): string {
    return `${plant.commonName} (${plant.scientificName})`;
  }

  private buildNameQuestion(plant: SuggestedPlant, pool: SuggestedPlant[]): QuizQuestion {
    const correctAnswer = this.formatName(plant);
    const distractors = this.pickDistractors(
      correctAnswer,
      pool.filter(p => p.id !== plant.id).map(p => this.formatName(p)),
      3
    );
    const { options, correctIndex } = this.shuffleOptions(correctAnswer, distractors);

    return {
      photo: this.pickPhoto(plant),
      plantName: correctAnswer,
      type: 'name',
      options,
      correctIndex,
    };
  }

  private buildFamilyQuestion(plant: SuggestedPlant, pool: SuggestedPlant[]): QuizQuestion {
    const correctAnswer = plant.family!;
    const distractors = this.pickDistractors(
      correctAnswer,
      [...new Set(pool.filter(p => p.family && p.family !== correctAnswer).map(p => p.family!))],
      3
    );
    const { options, correctIndex } = this.shuffleOptions(correctAnswer, distractors);

    return {
      photo: this.pickPhoto(plant),
      plantName: this.formatName(plant),
      type: 'family',
      options,
      correctIndex,
    };
  }

  private pickPhoto(plant: SuggestedPlant): string {
    // Prefer non-user photos (less recognizable), fall back to any
    const preferred = plant.photos.filter(ph => ph.source !== 'user');
    const pool = preferred.length > 0 ? preferred : plant.photos;
    return pool[Math.floor(Math.random() * pool.length)].url;
  }

  private pickDistractors(correct: string, candidates: string[], count: number): string[] {
    const unique = [...new Set(candidates)].filter(c => c !== correct);
    const shuffled = unique.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  private shuffleOptions(correct: string, distractors: string[]): { options: string[]; correctIndex: number } {
    const options = [correct, ...distractors].sort(() => Math.random() - 0.5);
    return { options, correctIndex: options.indexOf(correct) };
  }
}
