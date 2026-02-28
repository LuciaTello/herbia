import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Mission, SuggestedPlant, Plant, PlantPhoto, IdentifyResult } from '../models/plant.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class MissionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/missions`;

  private readonly missions = signal<Mission[]>([]);

  getMissions() {
    return this.missions;
  }

  async loadMissions(): Promise<void> {
    const missions = await firstValueFrom(
      this.http.get<Mission[]>(this.apiUrl)
    );
    this.missions.set(missions);
  }

  async createMission(
    origin: string, destination: string, description: string, plants: Plant[],
    country?: string, countryCode?: string, region?: string, regionCode?: string,
    originLat?: number | null, originLng?: number | null, destLat?: number | null, destLng?: number | null,
  ): Promise<Mission> {
    const mission = await firstValueFrom(
      this.http.post<Mission>(this.apiUrl, {
        origin, destination, description, plants,
        country, countryCode, region, regionCode,
        originLat, originLng, destLat, destLng,
      })
    );
    // Add to the beginning of the list (newest first)
    this.missions.update(list => [mission, ...list]);
    return mission;
  }

  async markPlantFound(plantId: number): Promise<void> {
    // Find the scientificName to do an optimistic update immediately
    const scientificName = this.missions()
      .flatMap(m => m.plants)
      .find(p => p.id === plantId)?.scientificName;

    if (scientificName) {
      const now = new Date().toISOString();
      this.missions.update(list =>
        list.map(mission => ({
          ...mission,
          plants: mission.plants.map(p =>
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

  async identifyPlant(plantId: number, file: File): Promise<IdentifyResult> {
    const formData = new FormData();
    formData.append('photo', file);
    return firstValueFrom(
      this.http.post<IdentifyResult>(`${this.apiUrl}/plants/${plantId}/identify`, formData)
    );
  }

  async uploadPlantPhoto(plantId: number, file: File): Promise<PlantPhoto> {
    const formData = new FormData();
    formData.append('photo', file);
    const photo = await firstValueFrom(
      this.http.post<PlantPhoto>(`${this.apiUrl}/plants/${plantId}/photo`, formData)
    );
    // Add the new photo to the matching plant (and all plants with same scientificName)
    const targetPlant = this.missions().flatMap(m => m.plants).find(p => p.id === plantId);
    if (targetPlant) {
      this.missions.update(list =>
        list.map(mission => ({
          ...mission,
          plants: mission.plants.map(p =>
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
    this.missions.update(list =>
      list.map(mission => ({
        ...mission,
        plants: mission.plants.map(p => ({
          ...p,
          photos: p.photos.filter(ph => ph.id !== photoId),
        })),
      }))
    );
  }

  async addUserPlant(missionId: number, file: File, prevResult?: IdentifyResult): Promise<{ plant: SuggestedPlant; identified: boolean }> {
    const formData = new FormData();
    formData.append('photo', file);
    if (prevResult) {
      formData.append('identifiedAs', prevResult.identifiedAs);
      formData.append('commonName', prevResult.commonName);
    }
    const result = await firstValueFrom(
      this.http.post<{ plant: SuggestedPlant; identified: boolean }>(
        `${this.apiUrl}/${missionId}/add-plant`, formData
      )
    );
    const scientificName = result.plant.scientificName;
    // Update signal: add/replace plant in matching mission + mark same species found everywhere
    this.missions.update(list => list.map(mission => {
      let plants = mission.plants.map(p =>
        // Mark all same-species plants as found across all missions
        scientificName && p.scientificName === scientificName && !p.found
          ? { ...p, found: true, foundAt: result.plant.foundAt }
          : p
      );
      if (mission.id === missionId) {
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
      return { ...mission, plants };
    }));
    return result;
  }

  async deleteUserPlant(plantId: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/plants/${plantId}`)
    );
    this.missions.update(list =>
      list.map(mission => ({
        ...mission,
        plants: mission.plants.filter(p => p.id !== plantId),
      }))
    );
  }

  async completeMission(id: number): Promise<void> {
    await firstValueFrom(
      this.http.patch(`${this.apiUrl}/${id}/complete`, {})
    );
    this.missions.update(list =>
      list.map(mission => mission.id === id ? { ...mission, status: 'completed' } : mission)
    );
  }

  async deleteMission(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/${id}`)
    );
    this.missions.update(list => list.filter(mission => mission.id !== id));
  }
}
