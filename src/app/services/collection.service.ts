import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FoundPlant, Plant } from '../models/plant.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/collection`;

  // The signal still holds the local "cache" of the collection for instant UI updates
  // But the source of truth is now PostgreSQL, not localStorage
  private readonly collection = signal<FoundPlant[]>([]);

  getCollection() {
    return this.collection;
  }

  // Load collection from the backend (called once when the app starts or page loads)
  // Before: this.loadFromStorage() (synchronous)
  // Now: this.loadCollection() (asynchronous - needs await because it's an HTTP call)
  async loadCollection(): Promise<void> {
    const plants = await firstValueFrom(
      this.http.get<FoundPlant[]>(this.apiUrl)
    );
    this.collection.set(plants);
  }

  isInCollection(plant: Plant): boolean {
    return this.collection()
      .some(found => found.scientificName === plant.scientificName);
  }

  // Before: synchronous, saved to localStorage
  // Now: async, sends POST to backend, then refreshes the local cache
  async addPlant(plant: Plant, route: string): Promise<void> {
    // Send the plant data to the backend (like restTemplate.postForObject)
    await firstValueFrom(
      this.http.post<FoundPlant>(this.apiUrl, {
        commonName: plant.commonName,
        scientificName: plant.scientificName,
        description: plant.description,
        imageUrl: plant.imageUrl,
        route,
      })
    );
    // Refresh the collection from the backend to stay in sync
    await this.loadCollection();
  }

  // Before: removePlant(plant: Plant) filtered by scientificName
  // Now: removePlant(id: number) deletes by id (like deleteById in JPA)
  async removePlant(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/${id}`)
    );
    // Remove from local signal immediately (no need to re-fetch)
    this.collection.update(list => list.filter(found => found.id !== id));
  }
}
