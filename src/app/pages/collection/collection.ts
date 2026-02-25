import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CollectionService } from '../../services/collection.service';
import { ImageService } from '../../services/image.service';
import { I18nService } from '../../i18n';
import { PhotoGalleryComponent } from '../../components/photo-gallery/photo-gallery';

@Component({
  selector: 'app-collection',
  imports: [RouterLink, PhotoGalleryComponent],
  templateUrl: './collection.html',
  styleUrl: './collection.css',
})
export class CollectionPage implements OnInit {
  private readonly collectionService = inject(CollectionService);
  private readonly imageService = inject(ImageService);
  protected readonly i18n = inject(I18nService);
  protected readonly collection = this.collectionService.getCollection();
  protected readonly loading = signal(true);
  protected readonly galleryImages = signal<string[]>([]);
  protected readonly galleryPlantName = signal('');

  async ngOnInit(): Promise<void> {
    try {
      await this.collectionService.loadCollection();
      // Enrich plants that have missing images (client-side iNaturalist fallback)
      const enriched = await this.imageService.enrichWithImages(this.collection());
      this.collectionService.updateCollection(enriched);
    } finally {
      this.loading.set(false);
    }
  }

  protected openGallery(images: string[] | undefined, name: string): void {
    if (images?.length) {
      this.galleryImages.set(images);
      this.galleryPlantName.set(name);
    }
  }

  protected closeGallery(): void {
    this.galleryImages.set([]);
    this.galleryPlantName.set('');
  }

  async removePlant(id: number): Promise<void> {
    await this.collectionService.removePlant(id);
  }
}
