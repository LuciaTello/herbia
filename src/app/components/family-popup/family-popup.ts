import { Component, inject, input, output, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { I18nService } from '../../i18n';
import { environment } from '../../../environments/environment';
import { PhotoGalleryComponent } from '../photo-gallery/photo-gallery';

interface FamilyPlant {
  id: number;
  scientificName: string;
  commonName: string;
  photoUrl: string | null;
  genus: string;
}

@Component({
  selector: 'app-family-popup',
  imports: [PhotoGalleryComponent],
  templateUrl: './family-popup.html',
  styleUrl: './family-popup.css',
})
export class FamilyPopupComponent implements OnInit {
  private readonly http = inject(HttpClient);
  protected readonly i18n = inject(I18nService);

  readonly family = input.required<string>();
  readonly close = output<void>();

  protected readonly loading = signal(true);
  protected readonly plants = signal<FamilyPlant[]>([]);
  protected readonly galleryImage = signal<string | null>(null);
  protected readonly galleryName = signal('');

  async ngOnInit(): Promise<void> {
    try {
      const url = `${environment.apiUrl}/plants/family/${encodeURIComponent(this.family())}`;
      const result = await firstValueFrom(this.http.get<FamilyPlant[]>(url));
      this.plants.set(result);
    } catch {
      this.plants.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected openPhoto(url: string, name: string): void {
    this.galleryImage.set(url);
    this.galleryName.set(name);
  }

  protected closeGallery(): void {
    this.galleryImage.set(null);
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }

  protected async onPhotoError(plant: FamilyPlant): Promise<void> {
    try {
      const result = await firstValueFrom(
        this.http.post<{ url: string | null }>(`${environment.apiUrl}/plants/${plant.id}/refresh-photo`, {})
      );
      plant.photoUrl = result.url;
    } catch {
      plant.photoUrl = null;
    }
  }
}
