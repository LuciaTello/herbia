import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TrekService } from '../../services/trek.service';
import { ImageService } from '../../services/image.service';
import { I18nService } from '../../i18n';
import { PhotoGalleryComponent } from '../../components/photo-gallery/photo-gallery';

@Component({
  selector: 'app-my-treks',
  imports: [RouterLink, DatePipe, PhotoGalleryComponent],
  templateUrl: './my-treks.html',
  styleUrl: './my-treks.css',
})
export class MyTreksPage implements OnInit {
  private readonly trekService = inject(TrekService);
  private readonly imageService = inject(ImageService);
  protected readonly i18n = inject(I18nService);
  protected readonly treks = this.trekService.getTreks();
  protected readonly loading = signal(true);
  protected readonly galleryImages = signal<string[]>([]);
  protected readonly galleryPlantName = signal('');

  async ngOnInit(): Promise<void> {
    try {
      await this.trekService.loadTreks();
      // Enrich plants that have missing images (client-side iNaturalist fallback)
      for (const trek of this.treks()) {
        this.imageService.enrichWithImages(trek.plants).then(enriched => {
          this.trekService.updateTrekPlants(trek.id, enriched);
        });
      }
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

  async markFound(plantId: number): Promise<void> {
    await this.trekService.markPlantFound(plantId);
  }

  async deleteTrek(id: number): Promise<void> {
    await this.trekService.deleteTrek(id);
  }
}
