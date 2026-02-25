import { inject, Injectable } from '@angular/core';
import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private readonly configService = inject(ConfigService);
  private loadPromise: Promise<boolean> | null = null;

  load(): Promise<boolean> {
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = this.configService.getGoogleMapsApiKey().then((key) => {
      if (!key) return false;

      return new Promise<boolean>((resolve) => {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.head.appendChild(script);
      });
    }).catch(() => false);

    return this.loadPromise;
  }
}
