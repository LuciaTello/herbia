import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Plant, PlantPhoto, PlaceSelection } from '../../models/plant.model';
import { PlantService } from '../../services/plant.service';
import { MissionService } from '../../services/mission.service';
import { AuthService } from '../../services/auth.service';
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
  private readonly missionService = inject(MissionService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);

  protected readonly mode = signal<'route' | 'zone'>('route');
  protected readonly origin = signal('');
  protected readonly destination = signal('');
  private originCountry = '';
  private originCountryCode = '';
  private originRegion = '';
  private originRegionCode = '';
  private originLat: number | null = null;
  private originLng: number | null = null;
  private destLat: number | null = null;
  private destLng: number | null = null;
  protected readonly plants = signal<Plant[]>([]);
  protected readonly description = signal('');
  protected readonly tooFar = signal(false);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly loadingMessage = signal('');
  protected readonly galleryImages = signal<string[]>([]);
  protected readonly galleryPlantName = signal('');
  protected readonly showMissionTip = signal(false);

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

  protected setMode(m: 'route' | 'zone'): void {
    this.mode.set(m);
    this.plants.set([]);
    this.description.set('');
    this.tooFar.set(false);
    this.error.set('');
  }

  protected onOriginSelected(selection: PlaceSelection): void {
    this.origin.set(selection.name);
    this.originCountry = selection.country || '';
    this.originCountryCode = selection.countryCode || '';
    this.originRegion = selection.region || '';
    this.originRegionCode = selection.regionCode || '';
    this.originLat = selection.lat ?? null;
    this.originLng = selection.lng ?? null;
  }

  protected onDestinationSelected(selection: PlaceSelection): void {
    this.destination.set(selection.name);
    this.destLat = selection.lat ?? null;
    this.destLng = selection.lng ?? null;
  }

  async onSearch(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    this.startLoadingMessages();
    try {
      const dest = this.mode() === 'zone' ? this.origin() : this.destination();
      const dLat = this.mode() === 'zone' ? this.originLat : this.destLat;
      const dLng = this.mode() === 'zone' ? this.originLng : this.destLng;
      const result = await this.plantService.getSuggestedPlants(
        this.origin(),
        dest,
        this.i18n.currentLang(),
        this.originLat,
        this.originLng,
        dLat,
        dLng,
        this.originRegion,
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

  protected onStartMissionClick(): void {
    if (this.auth.missionTipCount() < 4) {
      this.showMissionTip.set(true);
      return;
    }
    this.onStartMission();
  }

  protected async dismissMissionTip(): Promise<void> {
    this.showMissionTip.set(false);
    this.auth.dismissMissionTip();
    this.onStartMission();
  }

  async onStartMission(): Promise<void> {
    this.saving.set(true);
    try {
      const dest = this.mode() === 'zone' ? this.origin() : this.destination();
      const dLat = this.mode() === 'zone' ? this.originLat : this.destLat;
      const dLng = this.mode() === 'zone' ? this.originLng : this.destLng;
      const mission = await this.missionService.createMission(
        this.origin(),
        dest,
        this.description(),
        this.plants(),
        this.originCountry,
        this.originCountryCode,
        this.originRegion,
        this.originRegionCode,
        this.originLat,
        this.originLng,
        dLat,
        dLng,
      );
      this.router.navigate(['/my-missions'], { queryParams: { open: mission.id } });
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
