import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SuggestedPlant } from '../models/plant.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/collection`;

  // The collection = all SuggestedPlants where found=true (your herbarium)
  private readonly collection = signal<SuggestedPlant[]>([]);
  readonly friendCollection = signal<SuggestedPlant[]>([]);
  readonly friendName = signal<string | null>(null);

  getCollection() {
    return this.collection;
  }

  async loadCollection(): Promise<void> {
    const plants = await firstValueFrom(
      this.http.get<SuggestedPlant[]>(this.apiUrl)
    );
    this.collection.set(plants);
  }

  async loadFriendCollection(userId: number): Promise<void> {
    const [plants, profile] = await Promise.all([
      firstValueFrom(this.http.get<SuggestedPlant[]>(`${this.apiUrl}/${userId}`)),
      firstValueFrom(this.http.get<{ username: string | null }>(`${environment.apiUrl}/friends/${userId}/profile`)),
    ]);
    this.friendCollection.set(plants);
    this.friendName.set(profile.username);
  }

  // Soft-toggle: marks the plant as not found (removes from collection, keeps in trek)
  async removePlant(id: number): Promise<void> {
    await firstValueFrom(
      this.http.delete(`${this.apiUrl}/${id}`)
    );
    this.collection.update(list => list.filter(p => p.id !== id));
  }
}
