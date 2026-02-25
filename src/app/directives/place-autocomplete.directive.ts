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

    this.autocomplete = new google.maps.places.Autocomplete(this.el.nativeElement, {
      types: ['(cities)'],
    });

    this.listener = this.autocomplete.addListener('place_changed', () => {
      this.zone.run(() => {
        const place = this.autocomplete!.getPlace();
        const name = place.formatted_address || place.name || this.el.nativeElement.value;
        this.placeSelected.emit(name);
      });
    });
  }

  ngOnDestroy(): void {
    this.listener?.remove();
  }
}
