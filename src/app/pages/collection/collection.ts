import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlantPhoto } from '../../models/plant.model';
import { CollectionService } from '../../services/collection.service';
import { TrekService } from '../../services/trek.service';
import { I18nService } from '../../i18n';
import { PhotoGalleryComponent } from '../../components/photo-gallery/photo-gallery';
import { getRarity } from '../../utils/rarity';

@Component({
  selector: 'app-collection',
  imports: [RouterLink, PhotoGalleryComponent],
  templateUrl: './collection.html',
  styleUrl: './collection.css',
})
export class CollectionPage implements OnInit {
  private readonly collectionService = inject(CollectionService);
  private readonly trekService = inject(TrekService);
  protected readonly i18n = inject(I18nService);
  protected readonly collection = this.collectionService.getCollection();
  protected readonly loading = signal(true);
  protected readonly galleryImages = signal<string[]>([]);
  protected readonly galleryPlantName = signal('');

  protected rarity(rarity: string) { return getRarity(rarity, this.i18n.t()); }

  protected userPhotos(photos: PlantPhoto[]): PlantPhoto[] {
    return photos.filter(p => p.source === 'user');
  }

  protected refPhotos(photos: PlantPhoto[]): PlantPhoto[] {
    return photos.filter(p => p.source !== 'user');
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.collectionService.loadCollection();
    } finally {
      this.loading.set(false);
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

  async deletePhoto(photoId: number, plantId: number): Promise<void> {
    await this.trekService.deletePlantPhoto(photoId);
    // Update collection signal locally
    this.collectionService.getCollection().update(list =>
      list.map(p =>
        p.id === plantId
          ? { ...p, photos: p.photos.filter(ph => ph.id !== photoId) }
          : p
      )
    );
  }

  async removePlant(id: number): Promise<void> {
    await this.collectionService.removePlant(id);
  }
}
