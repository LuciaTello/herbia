import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

interface AppConfig {
  googleMapsApiKey: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly http = inject(HttpClient);
  private configPromise: Promise<AppConfig> | null = null;

  private fetchConfig(): Promise<AppConfig> {
    if (!this.configPromise) {
      this.configPromise = firstValueFrom(
        this.http.get<AppConfig>(`${environment.apiUrl}/config`),
      );
    }
    return this.configPromise;
  }

  async getGoogleMapsApiKey(): Promise<string> {
    const config = await this.fetchConfig();
    return config.googleMapsApiKey;
  }
}
