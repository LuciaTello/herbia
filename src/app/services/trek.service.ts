import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Trek, SuggestedPlant, Plant, PlantPhoto, IdentifyResult, IdentifyAllResult } from '../models/plant.model';
import { environment } from '../../environments/environment';
import { TrekCacheService } from './trek-cache.service';
import { ConnectivityService } from './connectivity.service';

@Injectable({ providedIn: 'root' })
export class TrekService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/treks`;
  private readonly trekCache = inject(TrekCacheService);
  private readonly connectivity = inject(ConnectivityService);

  private readonly treks = signal<Trek[]>([]);
  private initialLoaded = false;

  getTreks() {
    return this.treks;
  }

  async loadTreks(): Promise<void> {
    if (!this.initialLoaded) {
      this.initialLoaded = true;
      const cached = await this.trekCache.load();
      if (cached) this.treks.set(cached);
      if (!this.connectivity.online()) return;
      try {
        const treks = await firstValueFrom(this.http.get<Trek[]>(this.apiUrl));
        this.treks.set(treks);
        this.persistCache();
      } catch {
        // Already showing cached data
      }
      return;
    }

    if (!this.connectivity.online()) {
      const cached = await this.trekCache.load();
      if (cached) this.treks.set(cached);
      return;
    }

    const treks = await firstValueFrom(
      this.http.get<Trek[]>(this.apiUrl)
    );
    this.treks.set(treks);
    this.persistCache();
  }

  private persistCache(): void {
    this.trekCache.save(this.treks()).catch(() => {});
  }

  async createTrek(
    origin: string, destination: string, description: string, plants: Plant[],
    country?: string, countryCode?: string, region?: string, regionCode?: string,
    originLat?: number | null, originLng?: number | null, destLat?: number | null, destLng?: number | null,
  ): Promise<Trek> {
    const trek = await firstValueFrom(
      this.http.post<Trek>(this.apiUrl, {
        origin, destination, description, plants,
        country, countryCode, region, regionCode,
        originLat, originLng, destLat, destLng,
      })
    );
    // Add to the beginning of the list (newest first)
    this.treks.update(list => [trek, ...list]);
    this.persistCache();
    return trek;
  }

  async markPlantFound(plantId: number): Promise<void> {
    // Find the scientificName to do an optimistic update immediately
    const scientificName = this.treks()
      .flatMap(m => m.plants)
      .find(p => p.id === plantId)?.scientificName;

    if (scientificName) {
      const now = new Date().toISOString();
      this.treks.update(list =>
        list.map(trek => ({
          ...trek,
          plants: trek.plants.map(p =>
            p.scientificName === scientificName
              ? { ...p, found: true, foundAt: now }
              : p
          ),
        }))
      );
    }

    // Fire API call in background
    firstValueFrom(
      this.http.patch(`${this.apiUrl}/plants/${plantId}/found`, {})
    ).catch(() => {});
  }

  markPlantFoundLocally(plantId: number): void {
    const scientificName = this.treks()
      .flatMap(m => m.plants)
      .find(p => p.id === plantId)?.scientificName;

    if (scientificName) {
      const now = new Date().toISOString();
      this.treks.update(list =>
        list.map(trek => ({
          ...trek,
          plants: trek.plants.map(p =>
            p.scientificName === scientificName
              ? { ...p, found: true, foundAt: now }
              : p
          ),
        }))
      );
    }
  }

  async identifyPlant(plantId: number, file: File): Promise<IdentifyResult> {
    const formData = new FormData();
    formData.append('photo', file);
    return firstValueFrom(
      this.http.post<IdentifyResult>(`${this.apiUrl}/plants/${plantId}/identify`, formData)
    );
  }

  async identifyAll(trekId: number, file: File): Promise<IdentifyAllResult> {
    const formData = new FormData();
    formData.append('photo', file);
    return firstValueFrom(
      this.http.post<IdentifyAllResult>(`${this.apiUrl}/${trekId}/identify-all`, formData)
    );
  }

  async uploadPlantPhoto(plantId: number, file: File, similarity?: number, pn?: { identifiedAs?: string; commonName?: string }): Promise<PlantPhoto & { pointsOnly?: boolean }> {
    const formData = new FormData();
    formData.append('photo', file);
    if (similarity !== undefined) {
      formData.append('similarity', String(similarity));
    }
    if (pn?.identifiedAs) formData.append('identifiedAs', pn.identifiedAs);
    if (pn?.commonName) formData.append('identifiedCommonName', pn.commonName);
    const photo = await firstValueFrom(
      this.http.post<PlantPhoto & { pointsOnly?: boolean }>(`${this.apiUrl}/plants/${plantId}/photo`, formData)
    );
    // pointsOnly: photo was not saved (species limit reached)
    if (photo.pointsOnly) {
      return photo;
    }
    // Merge PlantNet identification into the photo (in case backend hasn't stored it yet)
    const enrichedPhoto: PlantPhoto = {
      ...photo,
      identifiedAs: photo.identifiedAs || pn?.identifiedAs,
      identifiedCommonName: photo.identifiedCommonName || pn?.commonName,
    };
    // Add the new photo to the matching plant (and all plants with same scientificName)
    const targetPlant = this.treks().flatMap(m => m.plants).find(p => p.id === plantId);
    if (targetPlant) {
      this.treks.update(list =>
        list.map(trek => ({
          ...trek,
          plants: trek.plants.map(p =>
            p.scientificName === targetPlant.scientificName
              ? { ...p, photos: [...p.photos, enrichedPhoto] }
              : p
          ),
        }))
      );
    }
    this.persistCache();
    return enrichedPhoto;
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

  async addUserPlant(trekId: number, file: File, prevResult?: IdentifyResult): Promise<{ plant: SuggestedPlant; identified: boolean; pointsOnly?: boolean }> {
    const formData = new FormData();
    formData.append('photo', file);
    if (prevResult) {
      formData.append('identifiedAs', prevResult.identifiedAs);
      formData.append('commonName', prevResult.commonName);
    }
    const result = await firstValueFrom(
      this.http.post<{ plant: SuggestedPlant; identified: boolean; pointsOnly?: boolean }>(
        `${this.apiUrl}/${trekId}/add-plant`, formData
      )
    );
    const scientificName = result.plant.scientificName;
    // Update signal: add/replace plant in matching trek + mark same species found everywhere
    this.treks.update(list => list.map(trek => {
      let plants = trek.plants.map(p =>
        // Mark all same-species plants as found across all treks
        scientificName && p.scientificName === scientificName && !p.found
          ? { ...p, found: true, foundAt: result.plant.foundAt }
          : p
      );
      if (trek.id === trekId) {
        const existingIdx = plants.findIndex(p => p.id === result.plant.id);
        if (existingIdx >= 0) {
          // Plant already existed — update it (new photo added)
          plants = [...plants];
          plants[existingIdx] = result.plant;
        } else {
          // New plant — append
          plants = [...plants, result.plant];
        }
      }
      return { ...trek, plants };
    }));
    this.persistCache();
    return result;
  }

  async deleteUserPlant(plantId: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/plants/${plantId}`)
    );
    this.treks.update(list =>
      list.map(trek => ({
        ...trek,
        plants: trek.plants.filter(p => p.id !== plantId),
      }))
    );
  }

  async completeTrek(id: number): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.apiUrl}/${id}/complete`, {})
    );
    this.treks.update(list =>
      list.map(trek => trek.id === id ? { ...trek, status: 'completed' } : trek)
    );
  }

  async reactivateTrek(id: number): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.apiUrl}/${id}/reactivate`, {})
    );
    this.treks.update(list =>
      list.map(trek => trek.id === id ? { ...trek, status: 'active' } : trek)
    );
  }

  async deleteTrek(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/${id}`)
    );
    this.treks.update(list => list.filter(trek => trek.id !== id));
  }
}
