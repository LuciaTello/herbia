import {
  Component, ElementRef, ViewChild, AfterViewInit,
  inject, NgZone, OnDestroy, output, input, signal, CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { GoogleMapsLoaderService } from '../services/google-maps-loader.service';

@Component({
  selector: 'app-place-autocomplete',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    @if (!ready()) {
      <input [placeholder]="placeholder()" disabled />
    }
    <div #container></div>
  `,
  styles: `
    :host { display: block; }
    input {
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

  @ViewChild('container', { read: ElementRef }) containerRef!: ElementRef<HTMLDivElement>;

  private el: google.maps.places.PlaceAutocompleteElement | null = null;

  async ngAfterViewInit(): Promise<void> {
    const loaded = await this.loader.load();
    if (!loaded) return;

    this.el = new google.maps.places.PlaceAutocompleteElement({
      types: ['(cities)'],
    });

    (this.el as any).placeholder = this.placeholder();
    this.el.style.width = '100%';

    this.el.addEventListener('gmp-placeselect', ((e: google.maps.places.PlaceAutocompletePlaceSelectEvent) => {
      this.zone.run(() => {
        const name = e.place.displayName?.toUpperCase() || '';
        this.placeSelected.emit(name);
      });
    }) as EventListener);

    this.containerRef.nativeElement.appendChild(this.el);
    this.zone.run(() => this.ready.set(true));
  }

  ngOnDestroy(): void {
    this.el?.remove();
  }
}
