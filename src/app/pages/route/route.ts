import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Plant, PlantPhoto, PlaceSelection } from '../../models/plant.model';
import { PlantService } from '../../services/plant.service';
import { TrekService } from '../../services/trek.service';
import { I18nService } from '../../i18n';
import { PhotoGalleryComponent } from '../../components/photo-gallery/photo-gallery';
import { PlaceAutocompleteDirective } from '../../directives/place-autocomplete.directive';
import { RouteMapComponent } from '../../components/route-map/route-map';
import { getRarity } from '../../utils/rarity';

@Component({
  selector: 'app-route',
  imports: [FormsModule, RouterLink, PhotoGalleryComponent, PlaceAutocompleteDirective, RouteMapComponent],
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
  private originCountry = '';
  private originCountryCode = '';
  private originRegion = '';
  private originRegionCode = '';
  protected readonly plants = signal<Plant[]>([]);
  protected readonly description = signal('');
  protected readonly tooFar = signal(false);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly loadingMessage = signal('');
  protected readonly galleryImages = signal<string[]>([]);
  protected readonly galleryPlantName = signal('');

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

  protected openGallery(photos: PlantPhoto[] | undefined, name: string): void {
    if (photos?.length) {
      this.galleryImages.set(photos.map(p => p.url));
      this.galleryPlantName.set(name);
    }
  }

  protected closeGallery(): void {
    this.galleryImages.set([]);
    this.galleryPlantName.set('');
  }

  protected rarity(rarity: string) { return getRarity(rarity, this.i18n.t()); }

  protected onOriginSelected(selection: PlaceSelection): void {
    this.origin.set(selection.name);
    this.originCountry = selection.country || '';
    this.originCountryCode = selection.countryCode || '';
    this.originRegion = selection.region || '';
    this.originRegionCode = selection.regionCode || '';
  }

  protected onDestinationSelected(selection: PlaceSelection): void {
    this.destination.set(selection.name);
  }

  async onSearch(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.startLoadingMessages();
    try {
      const result = await this.plantService.getSuggestedPlants(
        this.origin(),
        this.destination(),
        this.i18n.currentLang(),
      );
      this.tooFar.set(result.tooFar);
      this.description.set(result.description);
      if (!result.tooFar) {
        const sorted = [...result.plants].sort((a, b) => (a.rarity || 'common').localeCompare(b.rarity || 'common'));
        this.plants.set(sorted);
      } else {
        this.plants.set([]);
      }
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
      const trek = await this.trekService.createTrek(
        this.origin(),
        this.destination(),
        this.description(),
        this.plants(),
        this.originCountry,
        this.originCountryCode,
        this.originRegion,
        this.originRegionCode,
      );
      this.router.navigate(['/my-treks'], { queryParams: { open: trek.id } });
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 429) {
        this.error.set(this.i18n.t().route.dailyLimitReached);
      } else {
        this.error.set(this.i18n.t().route.error);
      }
    } finally {
      this.saving.set(false);
    }
  }
}
