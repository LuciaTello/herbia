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

  private routeLib: any = null;

  constructor() {
    this.loader.load().then(async (ok) => {
      if (!ok) return;
      this.routeLib = await google.maps.importLibrary('routes');
      this.ready.set(true);
    });

    effect(() => {
      const orig = this.origin();
      const dest = this.destination();
      const isReady = this.ready();

      if (!isReady || !orig || !dest || !this.routeLib) {
        this.routePath.set([]);
        return;
      }

      this.computeRoute(orig, dest);
    });
  }

  private async computeRoute(orig: string, dest: string): Promise<void> {
    try {
      const Route = this.routeLib.Route;
      const { routes } = await Route.computeRoutes({
        origin: orig,
        destination: dest,
        travelMode: 'WALK',
        fields: ['path'],
      });

      if (!routes?.length) {
        this.zone.run(() => this.routePath.set([]));
        return;
      }

      // Extract path from the route's polylines
      const polylines: google.maps.Polyline[] = routes[0].createPolylines();
      const path: google.maps.LatLngLiteral[] = [];
      for (const pl of polylines) {
        const plPath = pl.getPath();
        for (let i = 0; i < plPath.getLength(); i++) {
          const pt = plPath.getAt(i);
          path.push({ lat: pt.lat(), lng: pt.lng() });
        }
        // Remove the polyline from any map (we manage rendering via Angular MapPolyline)
        pl.setMap(null);
      }

      this.zone.run(() => {
        this.routePath.set(path);
        if (path.length) {
          // Center map on midpoint of route
          const mid = path[Math.floor(path.length / 2)];
          this.center.set(mid);
        }
      });
    } catch {
      this.zone.run(() => this.routePath.set([]));
    }
  }

  protected onMapReady(): void {
    // Fit bounds once the map and path are ready
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
