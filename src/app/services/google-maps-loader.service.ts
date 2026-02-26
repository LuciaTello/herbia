import { inject, Injectable } from '@angular/core';
import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private readonly configService = inject(ConfigService);
  private loadPromise: Promise<boolean> | null = null;

  load(): Promise<boolean> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.configService.getGoogleMapsApiKey().then(async (key) => {
      if (!key) return false;

      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&loading=async`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject();
        document.head.appendChild(script);
      });

      // With loading=async, libraries must be imported explicitly
      await google.maps.importLibrary('places');
      await google.maps.importLibrary('routes');

      return true;
    }).catch(() => false);

    return this.loadPromise;
  }
}
