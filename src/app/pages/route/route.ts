import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Plant } from '../../models/plant.model';
import { PlantService } from '../../services/plant.service';
import { TrekService } from '../../services/trek.service';
import { I18nService } from '../../i18n';

@Component({
  selector: 'app-route',
  imports: [FormsModule, RouterLink],
  templateUrl: './route.html',
  styleUrl: './route.css',
})
export class RoutePage {
  private readonly plantService = inject(PlantService);
  private readonly trekService = inject(TrekService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  protected readonly origin = signal('');
  protected readonly destination = signal('');
  protected readonly plants = signal<Plant[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly loadingMessage = signal('');

  // setInterval returns a handle we need to clear later (like ScheduledFuture in Java)
  private messageInterval: ReturnType<typeof setInterval> | null = null;

  // Starts rotating through fun messages every 3 seconds
  private startLoadingMessages(): void {
    this.loadingMessage.set(this.pickRandomMessage());
    this.messageInterval = setInterval(() => {
      this.loadingMessage.set(this.pickRandomMessage());
    }, 3000);
  }

  private stopLoadingMessages(): void {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);
      this.messageInterval = null;
    }
  }

  private pickRandomMessage(): string {
    const messages = this.i18n.t().route.loadingMessages;
    const index = Math.floor(Math.random() * messages.length);
    return messages[index];
  }

  async onSearch(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.startLoadingMessages();
    try {
      const results = await this.plantService.getSuggestedPlants(
        this.origin(),
        this.destination(),
        this.i18n.currentLang(),
      );
      this.plants.set(results);
    } catch (e) {
      this.error.set(this.i18n.t().route.error);
    } finally {
      this.loading.set(false);
      this.stopLoadingMessages();
    }
  }

  async onStartTrek(): Promise<void> {
    this.saving.set(true);
    try {
      await this.trekService.createTrek(
        this.origin(),
        this.destination(),
        this.i18n.currentLang(),
      );
      this.router.navigate(['/my-treks']);
    } catch (e) {
      this.error.set(this.i18n.t().route.error);
    } finally {
      this.saving.set(false);
    }
  }
}
