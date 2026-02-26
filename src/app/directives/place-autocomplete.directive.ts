import {
  Component, ElementRef, ViewChild, AfterViewInit,
  inject, NgZone, OnDestroy, output, input, signal, CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { GoogleMapsLoaderService } from '../services/google-maps-loader.service';

@Component({
  selector: 'app-place-autocomplete',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    @if (ready()) {
      <gmp-place-autocomplete #el></gmp-place-autocomplete>
    } @else {
      <input [placeholder]="placeholder()" disabled />
    }
  `,
  styles: `
    :host { display: block; }
    input, gmp-place-autocomplete {
      width: 100%;
      box-sizing: border-box;
      padding: 0.75rem;
      border: 2px solid #ddd;
      border-radius: 8px;
      font-size: 1rem;
    }
  `,
})
export class PlaceAutocompleteComponent implements AfterViewInit, OnDestroy {
  private readonly loader = inject(GoogleMapsLoaderService);
  private readonly zone = inject(NgZone);

  readonly placeholder = input('');
  readonly placeSelected = output<string>();
  protected readonly ready = signal(false);

  @ViewChild('el', { read: ElementRef }) set elRef(ref: ElementRef | undefined) {
    if (!ref) return;
    const el = ref.nativeElement as google.maps.places.PlaceAutocompleteElement;
    (el as any).placeholder = this.placeholder();
    el.types = ['(cities)'];

    el.addEventListener('gmp-placeselect', ((e: google.maps.places.PlaceAutocompletePlaceSelectEvent) => {
      this.zone.run(() => {
        const name = e.place.displayName?.toUpperCase() || '';
        this.placeSelected.emit(name);
      });
    }) as EventListener);
  }

  async ngAfterViewInit(): Promise<void> {
    const loaded = await this.loader.load();
    if (!loaded) return;
    this.zone.run(() => this.ready.set(true));
  }

  ngOnDestroy(): void {}
}
