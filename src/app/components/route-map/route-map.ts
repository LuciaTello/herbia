import { Component, effect, inject, input, NgZone, OnDestroy, signal, ViewChild } from '@angular/core';
import { GoogleMap, MapPolyline } from '@angular/google-maps';
import { GoogleMapsLoaderService } from '../../services/google-maps-loader.service';

@Component({
  selector: 'app-route-map',
  imports: [GoogleMap, MapPolyline],
  template: `
    @if (ready() && routePath().length) {
      <google-map width="100%" height="400px" [center]="center()" [zoom]="6"
                  (mapInitialized)="onMapReady()">
        <map-polyline [path]="routePath()" [options]="polylineOptions" />
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
export class RouteMapComponent implements OnDestroy {
  private readonly loader = inject(GoogleMapsLoaderService);
  private readonly zone = inject(NgZone);

  readonly origin = input.required<string>();
  readonly destination = input.required<string>();

  protected readonly ready = signal(false);
  protected readonly center = signal<google.maps.LatLngLiteral>({ lat: 40, lng: -3 });
  protected readonly routePath = signal<google.maps.LatLngLiteral[]>([]);

  @ViewChild(GoogleMap) private googleMap?: GoogleMap;

  protected readonly polylineOptions: google.maps.PolylineOptions = {
    strokeColor: '#2d7d46',
    strokeOpacity: 0.8,
    strokeWeight: 4,
  };

  private directionsService: google.maps.DirectionsService | null = null;

  constructor() {
    this.loader.load().then((ok) => {
      if (!ok) return;
      this.directionsService = new google.maps.DirectionsService();
      this.ready.set(true);
    });

    effect(() => {
      const orig = this.origin();
      const dest = this.destination();
      const isReady = this.ready();

      if (!isReady || !orig || !dest || !this.directionsService) {
        this.routePath.set([]);
        return;
      }

      this.computeRoute(orig, dest);
    });
  }

  private computeRoute(orig: string, dest: string): void {
    this.directionsService!.route(
      {
        origin: orig,
        destination: dest,
        travelMode: google.maps.TravelMode.WALKING,
      },
      (result, status) => {
        this.zone.run(() => {
          if (status !== google.maps.DirectionsStatus.OK || !result?.routes?.length) {
            this.routePath.set([]);
            return;
          }

          const path: google.maps.LatLngLiteral[] = [];
          for (const leg of result.routes[0].legs) {
            for (const step of leg.steps) {
              for (const pt of step.path) {
                path.push({ lat: pt.lat(), lng: pt.lng() });
              }
            }
          }

          this.routePath.set(path);
          if (path.length) {
            const mid = path[Math.floor(path.length / 2)];
            this.center.set(mid);
          }
        });
      },
    );
  }

  protected onMapReady(): void {
    const path = this.routePath();
    if (!path.length || !this.googleMap?.googleMap) return;
    const bounds = new google.maps.LatLngBounds();
    for (const pt of path) bounds.extend(pt);
    this.googleMap.googleMap.fitBounds(bounds);
  }

  ngOnDestroy(): void {
    this.routePath.set([]);
  }
}
