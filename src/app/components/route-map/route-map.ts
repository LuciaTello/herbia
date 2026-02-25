import { Component, effect, inject, input, signal } from '@angular/core';
import { GoogleMap, MapDirectionsRenderer } from '@angular/google-maps';
import { GoogleMapsLoaderService } from '../../services/google-maps-loader.service';

@Component({
  selector: 'app-route-map',
  imports: [GoogleMap, MapDirectionsRenderer],
  template: `
    @if (ready() && directions()) {
      <google-map width="100%" height="400px" [center]="center()" [zoom]="6">
        <map-directions-renderer [directions]="directions()!" />
      </google-map>
    }
  `,
  styles: `
    :host {
      display: block;
      margin-top: 1.5rem;
      border-radius: 12px;
      overflow: hidden;
    }
  `,
})
export class RouteMapComponent {
  private readonly loader = inject(GoogleMapsLoaderService);

  readonly origin = input.required<string>();
  readonly destination = input.required<string>();

  protected readonly ready = signal(false);
  protected readonly center = signal<google.maps.LatLngLiteral>({ lat: 40, lng: -3 });
  protected readonly directions = signal<google.maps.DirectionsResult | null>(null);

  constructor() {
    // Load Google Maps script
    this.loader.load().then((ok) => this.ready.set(ok));

    // Recalculate route when inputs change and maps is ready
    effect(() => {
      const orig = this.origin();
      const dest = this.destination();
      const isReady = this.ready();

      if (!isReady || !orig || !dest) {
        this.directions.set(null);
        return;
      }

      const svc = new google.maps.DirectionsService();
      svc.route(
        {
          origin: orig,
          destination: dest,
          travelMode: google.maps.TravelMode.WALKING,
        },
        (result, status) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            this.directions.set(result);
          } else {
            this.directions.set(null);
          }
        },
      );
    });
  }
}
