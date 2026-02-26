import {
  Component, ElementRef, ViewChild, AfterViewInit,
  inject, NgZone, OnDestroy, output, input, CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { GoogleMapsLoaderService } from '../services/google-maps-loader.service';

@Component({
  selector: 'app-place-autocomplete',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `<gmp-place-autocomplete #el [attr.placeholder]="placeholder()"></gmp-place-autocomplete>`,
  styles: `
    :host { display: block; }
    gmp-place-autocomplete { width: 100%; }
  `,
})
export class PlaceAutocompleteComponent implements AfterViewInit, OnDestroy {
  private readonly loader = inject(GoogleMapsLoaderService);
  private readonly zone = inject(NgZone);

  readonly placeholder = input('');
  readonly placeSelected = output<string>();

  @ViewChild('el', { read: ElementRef }) elRef!: ElementRef;

  private listener: google.maps.MapsEventListener | null = null;

  async ngAfterViewInit(): Promise<void> {
    const loaded = await this.loader.load();
    if (!loaded) return;

    const el = this.elRef.nativeElement as google.maps.places.PlaceAutocompleteElement;
    el.types = ['(cities)'];

    this.listener = el.addEventListener('gmp-placeselect', ((e: google.maps.places.PlaceAutocompletePlaceSelectEvent) => {
      this.zone.run(() => {
        const place = e.place;
        const name = place.displayName?.toUpperCase() || '';
        this.placeSelected.emit(name);
      });
    }) as EventListener) as unknown as google.maps.MapsEventListener;
  }

  ngOnDestroy(): void {
    this.listener?.remove();
  }
}
