import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SuggestedPlant } from '../models/plant.model';
import { environment } from '../../environments/environment';

export interface QuizQuestion {
  photos: string[];
  plantName: string;
  type: 'name' | 'family';
  options: string[];
  correctIndex: number;
}

const MIN_PHOTOS = 5;
const MAX_PHOTOS = 5;

@Injectable({ providedIn: 'root' })
export class ChallengeService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/challenges`;

  readonly quizPlants = signal<SuggestedPlant[]>([]);
  readonly questions = signal<QuizQuestion[]>([]);
  readonly currentIndex = signal(0);
  readonly score = signal(0);
  readonly answered = signal<number | null>(null); // index chosen, null = not yet answered
  readonly finished = signal(false);

  /** Fetch quiz-eligible plants with localized names from backend */
  async loadQuizPlants(): Promise<void> {
    const plants = await firstValueFrom(
      this.http.get<SuggestedPlant[]>(`${this.apiUrl}/quiz-plants`)
    );
    this.quizPlants.set(plants);
  }

  /** Generate 10 quiz questions from pre-loaded quiz plants */
  async generateQuiz(): Promise<boolean> {
    const eligible = this.quizPlants().filter(p => p.commonName);

    if (eligible.length < 10) return false;

    // Deduplicate by scientificName (merge photos from different treks)
    const bySpecies = new Map<string, SuggestedPlant>();
    for (const p of eligible) {
      const existing = bySpecies.get(p.scientificName);
      if (existing) {
        existing.photos = [...existing.photos, ...p.photos];
      } else {
        bySpecies.set(p.scientificName, { ...p, photos: [...p.photos] });
      }
    }
    const unique = [...bySpecies.values()];

    if (unique.length < 10) return false;

    // Unique families for family-type questions
    const families = new Set(unique.filter(p => p.family).map(p => p.family!));
    const canAskFamily = families.size >= 4;

    // Pick 10 random plants
    const shuffled = unique.sort(() => Math.random() - 0.5);
    const picked = shuffled.slice(0, 10);

    // Collect photos for each picked plant: user photos first, then reference
    const photoArrays = picked.map(plant => this.collectPhotos(plant));

    // Find plants that need extra iNaturalist photos
    const needExtra: { scientificName: string; need: number; index: number }[] = [];
    for (let i = 0; i < picked.length; i++) {
      if (photoArrays[i].length < MIN_PHOTOS) {
        needExtra.push({
          scientificName: picked[i].scientificName,
          need: MIN_PHOTOS - photoArrays[i].length,
          index: i,
        });
      }
    }

    // Fetch extra photos from iNaturalist if needed
    if (needExtra.length > 0) {
      try {
        const extra = await firstValueFrom(
          this.http.post<Record<string, string[]>>(`${this.apiUrl}/quiz-extra-photos`, {
            plants: needExtra.map(e => ({ scientificName: e.scientificName, need: e.need })),
          })
        );
        for (const entry of needExtra) {
          const urls = extra[entry.scientificName] || [];
          photoArrays[entry.index].push(...urls);
        }
      } catch { /* proceed with what we have */ }
    }

    // Build questions
    const questions: QuizQuestion[] = picked.map((plant, i) => {
      const photos = photoArrays[i].slice(0, MAX_PHOTOS);
      const askFamily = canAskFamily && plant.family && Math.random() < 0.35;

      if (askFamily) {
        return this.buildFamilyQuestion(plant, eligible, photos);
      }
      return this.buildNameQuestion(plant, eligible, photos);
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

  /** Collect photos: user photos first, then reference (wikipedia/inaturalist), up to MAX_PHOTOS */
  private collectPhotos(plant: SuggestedPlant): string[] {
    const userPhotos = plant.photos.filter(ph => ph.source === 'user').map(ph => ph.url);
    const refPhotos = plant.photos.filter(ph => ph.source !== 'user').map(ph => ph.url);
    const combined = [...userPhotos, ...refPhotos];
    return combined.slice(0, MAX_PHOTOS);
  }

  private formatName(plant: SuggestedPlant): string {
    return `${plant.commonName} (${plant.scientificName})`;
  }

  private buildNameQuestion(plant: SuggestedPlant, pool: SuggestedPlant[], photos: string[]): QuizQuestion {
    const correctAnswer = this.formatName(plant);
    const distractors = this.pickDistractors(
      correctAnswer,
      pool.filter(p => p.id !== plant.id).map(p => this.formatName(p)),
      2
    );
    const { options, correctIndex } = this.shuffleOptions(correctAnswer, distractors);

    return {
      photos,
      plantName: correctAnswer,
      type: 'name',
      options,
      correctIndex,
    };
  }

  private buildFamilyQuestion(plant: SuggestedPlant, pool: SuggestedPlant[], photos: string[]): QuizQuestion {
    const correctAnswer = plant.family!;
    const distractors = this.pickDistractors(
      correctAnswer,
      [...new Set(pool.filter(p => p.family && p.family !== correctAnswer).map(p => p.family!))],
      2
    );
    const { options, correctIndex } = this.shuffleOptions(correctAnswer, distractors);

    return {
      photos,
      plantName: this.formatName(plant),
      type: 'family',
      options,
      correctIndex,
    };
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
