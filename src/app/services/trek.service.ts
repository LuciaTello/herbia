import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Trek, SuggestedPlant, Plant } from '../models/plant.model';
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
    const updated = await firstValueFrom(
      this.http.patch<SuggestedPlant>(`${this.apiUrl}/plants/${plantId}/found`, {})
    );
    // Update the plant in the local signal
    this.treks.update(list =>
      list.map(trek => ({
        ...trek,
        plants: trek.plants.map(p =>
          p.id === plantId ? { ...p, found: updated.found, foundAt: updated.foundAt } : p
        ),
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
