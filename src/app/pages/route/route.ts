import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Plant } from '../../models/plant.model';
import { PlantService } from '../../services/plant.service';
import { CollectionService } from '../../services/collection.service';
import { I18nService } from '../../i18n';

@Component({
  selector: 'app-route',
  imports: [FormsModule, RouterLink],
  templateUrl: './route.html',
  styleUrl: './route.css',
})
export class RoutePage implements OnInit {
  // inject() is like @Autowired in Spring: Angular provides the singleton instance
  private readonly plantService = inject(PlantService);
  private readonly collectionService = inject(CollectionService);
  protected readonly i18n = inject(I18nService);

  protected readonly origin = signal('');
  protected readonly destination = signal('');
  protected readonly plants = signal<Plant[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly loadingMessage = signal('');

  // setInterval returns a handle we need to clear later (like ScheduledFuture in Java)
  private messageInterval: ReturnType<typeof setInterval> | null = null;

  // Load collection from backend so isInCollection() works
  async ngOnInit(): Promise<void> {
    await this.collectionService.loadCollection();
  }

  // Starts rotating through fun messages every 3 seconds
  // In Java: like a ScheduledExecutorService.scheduleAtFixedRate()
  private startLoadingMessages(): void {
    // Show a random message immediately (don't wait 3 seconds for the first one)
    this.loadingMessage.set(this.pickRandomMessage());
    // Then rotate every 3 seconds
    this.messageInterval = setInterval(() => {
      this.loadingMessage.set(this.pickRandomMessage());
    }, 3000);
  }

  private stopLoadingMessages(): void {
    if (this.messageInterval) {
      clearInterval(this.messageInterval);   // Like future.cancel() in Java
      this.messageInterval = null;
    }
  }

  // Pick a random message from the i18n loading messages array
  private pickRandomMessage(): string {
    const messages = this.i18n.t().route.loadingMessages;
    const index = Math.floor(Math.random() * messages.length);
    return messages[index];
  }

  // async because we now await the backend response
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

  // Now async because addPlant calls the backend API
  async onPlantFound(plant: Plant): Promise<void> {
    const route = `${this.origin()} → ${this.destination()}`;
    await this.collectionService.addPlant(plant, route);
  }

  isInCollection(plant: Plant): boolean {
    return this.collectionService.isInCollection(plant);
  }
}
