import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Plant, SuggestResult } from '../models/plant.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class PlantService {
  private readonly http = inject(HttpClient);
  // In dev: '/api' (proxied to localhost:3000)
  // In prod: 'https://herbia-server.onrender.com/api' (Render URL)
  private readonly apiUrl = `${environment.apiUrl}`;

  async getSuggestedPlants(
    origin: string,
    destination: string,
    lang: string,
    originLat?: number | null,
    originLng?: number | null,
    destLat?: number | null,
    destLng?: number | null,
    region?: string,
  ): Promise<SuggestResult> {
    // firstValueFrom converts an Observable to a Promise (so we can use async/await)
    // This is like calling restTemplate.postForObject() in Spring
    return firstValueFrom(
      this.http.post<SuggestResult>(`${this.apiUrl}/plants/suggest`, {
        origin, destination, lang, originLat, originLng, destLat, destLng, region,
      })
    );
  }
}
