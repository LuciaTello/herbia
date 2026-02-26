import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Trek, SuggestedPlant, Plant, PlantPhoto } from '../models/plant.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class TrekService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/treks`;

  private readonly treks = signal<Trek[]>([]);

  getTreks() {
    return this.treks;
  }

  async loadTreks(): Promise<void> {
    const treks = await firstValueFrom(
      this.http.get<Trek[]>(this.apiUrl)
    );
    this.treks.set(treks);
  }

  async createTrek(origin: string, destination: string, description: string, plants: Plant[]): Promise<Trek> {
    const trek = await firstValueFrom(
      this.http.post<Trek>(this.apiUrl, { origin, destination, description, plants })
    );
    // Add to the beginning of the list (newest first)
    this.treks.update(list => [trek, ...list]);
    return trek;
  }

  async markPlantFound(plantId: number): Promise<void> {
    const result = await firstValueFrom(
      this.http.patch<{ scientificName: string; found: boolean; foundAt: string }>(
        `${this.apiUrl}/plants/${plantId}/found`, {}
      )
    );
    // Mark ALL plants with the same scientificName as found across all treks
    this.treks.update(list =>
      list.map(trek => ({
        ...trek,
        plants: trek.plants.map(p =>
          p.scientificName === result.scientificName
            ? { ...p, found: true, foundAt: result.foundAt }
            : p
        ),
      }))
    );
  }

  async uploadPlantPhoto(plantId: number, file: File): Promise<PlantPhoto> {
    const formData = new FormData();
    formData.append('photo', file);
    const photo = await firstValueFrom(
      this.http.post<PlantPhoto>(`${this.apiUrl}/plants/${plantId}/photo`, formData)
    );
    // Add the new photo to the matching plant (and all plants with same scientificName)
    const targetPlant = this.treks().flatMap(t => t.plants).find(p => p.id === plantId);
    if (targetPlant) {
      this.treks.update(list =>
        list.map(trek => ({
          ...trek,
          plants: trek.plants.map(p =>
            p.scientificName === targetPlant.scientificName
              ? { ...p, photos: [...p.photos, photo] }
              : p
          ),
        }))
      );
    }
    return photo;
  }

  async deletePlantPhoto(photoId: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/photos/${photoId}`)
    );
    this.treks.update(list =>
      list.map(trek => ({
        ...trek,
        plants: trek.plants.map(p => ({
          ...p,
          photos: p.photos.filter(ph => ph.id !== photoId),
        })),
      }))
    );
  }

  async deleteTrek(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/${id}`)
    );
    this.treks.update(list => list.filter(trek => trek.id !== id));
  }
}
