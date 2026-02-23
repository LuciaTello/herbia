import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Plant } from '../models/plant.model';

@Injectable({ providedIn: 'root' })
export class PlantService {
  // HttpClient is like Java's RestTemplate / WebClient
  private readonly http = inject(HttpClient);
  // Relative URL: in production, Angular and Express run on the same server
  // In local dev, Angular CLI proxies /api to localhost:3000 (see proxy.conf.json)
  private readonly apiUrl = '/api';

  async getSuggestedPlants(origin: string, destination: string): Promise<Plant[]> {
    // firstValueFrom converts an Observable to a Promise (so we can use async/await)
    // This is like calling restTemplate.postForObject() in Spring
    return firstValueFrom(
      this.http.post<Plant[]>(`${this.apiUrl}/plants/suggest`, { origin, destination })
    );
  }
}
