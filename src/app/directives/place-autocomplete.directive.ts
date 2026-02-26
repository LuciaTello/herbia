import { Directive, ElementRef, inject, NgZone, OnDestroy, OnInit, output } from '@angular/core';
import { GoogleMapsLoaderService } from '../services/google-maps-loader.service';

@Directive({ selector: '[appPlaceAutocomplete]' })
export class PlaceAutocompleteDirective implements OnInit, OnDestroy {
  private readonly el = inject(ElementRef<HTMLInputElement>);
  private readonly zone = inject(NgZone);
  private readonly loader = inject(GoogleMapsLoaderService);

  readonly placeSelected = output<string>();

  private autocomplete: google.maps.places.Autocomplete | null = null;
  private listener: google.maps.MapsEventListener | null = null;

  async ngOnInit(): Promise<void> {
    const loaded = await this.loader.load();
    if (!loaded) return;

    const { Autocomplete } = await google.maps.importLibrary('places') as google.maps.PlacesLibrary;
    this.autocomplete = new Autocomplete(this.el.nativeElement, {
      types: ['(cities)'],
      fields: ['address_components', 'name'],
    });

    this.listener = this.autocomplete.addListener('place_changed', () => {
      this.zone.run(() => {
        const place = this.autocomplete!.getPlace();
        const components = place.address_components || [];
        const city = components.find(c => c.types.includes('locality'))?.long_name
          || place.name
          || this.el.nativeElement.value;
        const postalCode = components.find(c => c.types.includes('postal_code'))?.long_name;
        const name = postalCode ? `${city.toUpperCase()} (${postalCode})` : city.toUpperCase();
        this.placeSelected.emit(name);
      });
    });
  }

  ngOnDestroy(): void {
    this.listener?.remove();
  }
}
