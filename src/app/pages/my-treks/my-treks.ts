import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PlantPhoto } from '../../models/plant.model';
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
    this.uploadingPhotoId.set(plantId);
    try {
      await this.trekService.uploadPlantPhoto(plantId, file);
    } finally {
      this.uploadingPhotoId.set(null);
      input.value = '';
    }
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
}
