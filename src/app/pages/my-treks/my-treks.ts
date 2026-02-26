import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PlantPhoto, IdentifyResult, SuggestedPlant } from '../../models/plant.model';
import { TrekService } from '../../services/trek.service';
import { I18nService } from '../../i18n';
import { PhotoGalleryComponent } from '../../components/photo-gallery/photo-gallery';
import { getRarity } from '../../utils/rarity';

@Component({
  selector: 'app-my-treks',
  imports: [RouterLink, DatePipe, PhotoGalleryComponent],
  templateUrl: './my-treks.html',
  styleUrl: './my-treks.css',
})
export class MyTreksPage implements OnInit {
  private readonly trekService = inject(TrekService);
  private readonly route = inject(ActivatedRoute);
  protected readonly i18n = inject(I18nService);
  protected readonly treks = this.trekService.getTreks();
  protected readonly loading = signal(true);
  protected readonly expandedId = signal<number | null>(null);
  protected readonly galleryImages = signal<string[]>([]);
  protected readonly galleryPlantName = signal('');
  protected readonly uploadingPhotoId = signal<number | null>(null);
  protected readonly identifying = signal<number | null>(null);
  protected readonly pendingFile = signal<File | null>(null);
  protected readonly pendingPlantId = signal<number | null>(null);
  protected readonly identifyResult = signal<IdentifyResult | null>(null);
  protected readonly addingPlantForTrek = signal<number | null>(null);
  protected readonly showUnidentifiedFor = signal<number | null>(null);
  protected readonly addPlantMessage = signal<string | null>(null);

  protected rarity(rarity: string) { return getRarity(rarity, this.i18n.t()); }

  protected userPhotos(photos: PlantPhoto[]): PlantPhoto[] {
    return photos.filter(p => p.source === 'user');
  }

  protected refPhotos(photos: PlantPhoto[]): PlantPhoto[] {
    return photos.filter(p => p.source !== 'user');
  }

  protected foundCount(plants: { found: boolean }[]): number {
    return plants.filter(p => p.found).length;
  }

  protected toggle(id: number): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.trekService.loadTreks();
    } finally {
      this.loading.set(false);
    }
    const openId = Number(this.route.snapshot.queryParamMap.get('open'));
    if (openId) {
      this.expandedId.set(openId);
    }
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

  async onPhotoSelected(event: Event, plantId: number): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    this.pendingFile.set(file);
    this.pendingPlantId.set(plantId);
    this.identifyResult.set(null);
    this.identifying.set(plantId);

    try {
      const result = await this.trekService.identifyPlant(plantId, file);
      this.identifyResult.set(result);
    } catch {
      // PlantNet failed — skip identification, upload directly
      await this.confirmUpload();
    } finally {
      this.identifying.set(null);
    }
  }

  async confirmUpload(): Promise<void> {
    const file = this.pendingFile();
    const plantId = this.pendingPlantId();
    if (!file || !plantId) return;

    this.identifyResult.set(null);
    this.uploadingPhotoId.set(plantId);
    try {
      await this.trekService.uploadPlantPhoto(plantId, file);
    } finally {
      this.uploadingPhotoId.set(null);
      this.pendingFile.set(null);
      this.pendingPlantId.set(null);
    }
  }

  cancelUpload(): void {
    this.pendingFile.set(null);
    this.pendingPlantId.set(null);
    this.identifyResult.set(null);
  }

  async deletePhoto(photoId: number): Promise<void> {
    await this.trekService.deletePlantPhoto(photoId);
  }

  async markFound(plantId: number): Promise<void> {
    await this.trekService.markPlantFound(plantId);
  }

  async deleteTrek(id: number): Promise<void> {
    await this.trekService.deleteTrek(id);
  }

  async deleteUserPlant(plantId: number): Promise<void> {
    await this.trekService.deleteUserPlant(plantId);
  }

  protected aiPlants(plants: SuggestedPlant[]): SuggestedPlant[] {
    return plants.filter(p => p.source !== 'user');
  }

  protected userPlants(plants: SuggestedPlant[]): SuggestedPlant[] {
    return plants.filter(p => p.source === 'user' && p.scientificName !== '');
  }

  protected unidentifiedPlants(plants: SuggestedPlant[]): SuggestedPlant[] {
    return plants.filter(p => p.source === 'user' && p.scientificName === '');
  }

  protected toggleUnidentified(trekId: number): void {
    this.showUnidentifiedFor.set(this.showUnidentifiedFor() === trekId ? null : trekId);
  }

  async onAddPlant(event: Event, trekId: number): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';

    this.addingPlantForTrek.set(trekId);
    this.addPlantMessage.set(null);

    try {
      const result = await this.trekService.addUserPlant(trekId, file);
      this.addPlantMessage.set(this.i18n.t().myTreks.plantAdded);
      setTimeout(() => this.addPlantMessage.set(null), 3000);
    } catch (err: any) {
      if (err?.status === 409) {
        this.addPlantMessage.set(this.i18n.t().myTreks.maxPhotosReached);
        setTimeout(() => this.addPlantMessage.set(null), 4000);
      }
    } finally {
      this.addingPlantForTrek.set(null);
    }
  }
}
