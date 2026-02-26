import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlantPhoto } from '../../models/plant.model';
import { CollectionService } from '../../services/collection.service';
import { TrekService } from '../../services/trek.service';
import { I18nService } from '../../i18n';
import { PhotoGalleryComponent } from '../../components/photo-gallery/photo-gallery';
import { WorldMapComponent } from '../../components/world-map/world-map';
import { getRarity } from '../../utils/rarity';
import { getContinent, getContinentName, countryFlag } from '../../utils/continents';
import { getCountryName } from '../../utils/country-names';

type CollectionView = 'map' | 'countries' | 'regions' | 'plants';

@Component({
  selector: 'app-collection',
  imports: [RouterLink, PhotoGalleryComponent, WorldMapComponent],
  templateUrl: './collection.html',
  styleUrl: './collection.css',
})
export class CollectionPage implements OnInit {
  private readonly collectionService = inject(CollectionService);
  private readonly trekService = inject(TrekService);
  protected readonly i18n = inject(I18nService);
  protected readonly collection = this.collectionService.getCollection();
  protected readonly loading = signal(true);
  protected readonly galleryImages = signal<string[]>([]);
  protected readonly galleryPlantName = signal('');

  // Drill-down state
  protected readonly view = signal<CollectionView>('map');
  protected readonly selectedContinent = signal<string | null>(null);
  protected readonly selectedCountry = signal<string | null>(null);
  protected readonly selectedCountryCode = signal<string | null>(null);
  protected readonly selectedRegion = signal<string | null>(null);

  protected rarity(rarity: string) { return getRarity(rarity, this.i18n.t()); }

  protected userPhotos(photos: PlantPhoto[]): PlantPhoto[] {
    return photos.filter(p => p.source === 'user');
  }

  protected refPhotos(photos: PlantPhoto[]): PlantPhoto[] {
    return photos.filter(p => p.source !== 'user');
  }

  // Only identified plants (scientificName != '')
  private readonly identifiedPlants = computed(() =>
    this.collection().filter(p => p.scientificName !== '')
  );

  // Unidentified plants (scientificName == '')
  protected readonly unidentifiedPlants = computed(() =>
    this.collection().filter(p => p.scientificName === '')
  );

  // Plants with location data
  private readonly locatedPlants = computed(() =>
    this.identifiedPlants().filter(p => p.trek?.countryCode)
  );

  // Plants without location data
  protected readonly noLocationPlants = computed(() =>
    this.identifiedPlants().filter(p => !p.trek?.countryCode)
  );

  // Continent → plant count (for the map)
  protected readonly continentCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const p of this.locatedPlants()) {
      const continent = getContinent(p.trek!.countryCode!);
      if (continent) {
        counts[continent] = (counts[continent] || 0) + 1;
      }
    }
    return counts;
  });

  // Countries in the selected continent
  protected readonly countriesInContinent = computed(() => {
    const continent = this.selectedContinent();
    if (!continent) return [];
    const lang = this.i18n.currentLang();
    const countryMap = new Map<string, { code: string; name: string; flag: string; count: number }>();
    for (const p of this.locatedPlants()) {
      const code = p.trek!.countryCode!;
      if (getContinent(code) !== continent) continue;
      const existing = countryMap.get(code);
      if (existing) {
        existing.count++;
      } else {
        countryMap.set(code, {
          code,
          name: getCountryName(code, lang),
          flag: countryFlag(code),
          count: 1,
        });
      }
    }
    return [...countryMap.values()].sort((a, b) => b.count - a.count);
  });

  // Regions in the selected country
  protected readonly regionsInCountry = computed(() => {
    const code = this.selectedCountryCode();
    if (!code) return [];
    const regionMap = new Map<string, { name: string; count: number }>();
    for (const p of this.locatedPlants()) {
      if (p.trek!.countryCode !== code) continue;
      const regionName = p.trek!.region || '?';
      const existing = regionMap.get(regionName);
      if (existing) {
        existing.count++;
      } else {
        regionMap.set(regionName, { name: regionName, count: 1 });
      }
    }
    return [...regionMap.values()].sort((a, b) => b.count - a.count);
  });

  // Plants in the selected view
  protected readonly plantsInView = computed(() => {
    const code = this.selectedCountryCode();
    const region = this.selectedRegion();
    // "no location" mode: show plants without countryCode
    if (this.view() === 'plants' && !code) {
      return this.noLocationPlants();
    }
    if (!code) return [];
    return this.locatedPlants().filter(p => {
      if (p.trek!.countryCode !== code) return false;
      if (region) return (p.trek!.region || '?') === region;
      return true;
    });
  });

  // Breadcrumb
  protected readonly breadcrumb = computed(() => {
    const lang = this.i18n.currentLang();
    const parts: { label: string; action: CollectionView | null }[] = [];
    parts.push({ label: this.i18n.t().collection.mapTitle, action: 'map' });

    const v = this.view();
    if (v === 'map') return parts;

    // "no location" special case
    if (v === 'plants' && !this.selectedCountryCode()) {
      parts.push({ label: this.i18n.t().collection.noLocation, action: null });
      return parts;
    }

    const continent = this.selectedContinent();
    if (continent) {
      parts.push({ label: getContinentName(continent, lang), action: 'countries' });
    }
    const countryCode = this.selectedCountryCode();
    const countryName = this.selectedCountry();
    if (countryCode && countryName) {
      parts.push({ label: `${countryFlag(countryCode)} ${countryName}`, action: 'regions' });
    }
    const region = this.selectedRegion();
    if (region) {
      parts.push({ label: region, action: null });
    }
    return parts;
  });

  async ngOnInit(): Promise<void> {
    try {
      await this.collectionService.loadCollection();
    } finally {
      this.loading.set(false);
    }
  }

  protected onContinentSelected(continentId: string): void {
    this.selectedContinent.set(continentId);
    this.selectedCountry.set(null);
    this.selectedCountryCode.set(null);
    this.selectedRegion.set(null);
    this.view.set('countries');
  }

  protected onCountrySelected(code: string, name: string): void {
    this.selectedCountryCode.set(code);
    this.selectedCountry.set(name);
    this.selectedRegion.set(null);
    this.view.set('regions');
  }

  protected onRegionSelected(region: string): void {
    this.selectedRegion.set(region);
    this.view.set('plants');
  }

  protected onShowAllFromCountry(): void {
    this.selectedRegion.set(null);
    this.view.set('plants');
  }

  protected onShowNoLocation(): void {
    this.selectedContinent.set(null);
    this.selectedCountry.set(null);
    this.selectedCountryCode.set(null);
    this.selectedRegion.set(null);
    this.view.set('plants');
  }

  protected navigateTo(action: CollectionView | null): void {
    if (!action) return;
    if (action === 'map') {
      this.selectedContinent.set(null);
      this.selectedCountry.set(null);
      this.selectedCountryCode.set(null);
      this.selectedRegion.set(null);
    } else if (action === 'countries') {
      this.selectedCountry.set(null);
      this.selectedCountryCode.set(null);
      this.selectedRegion.set(null);
    } else if (action === 'regions') {
      this.selectedRegion.set(null);
    }
    this.view.set(action);
  }

  protected openGallery(photos: PlantPhoto[] | undefined, name: string): void {
    if (photos?.length) {
      this.galleryImages.set(photos.map(p => p.url));
      this.galleryPlantName.set(name);
    }
  }

  protected closeGallery(): void {
    this.galleryImages.set([]);
    this.galleryPlantName.set('');
  }

  async deletePhoto(photoId: number, plantId: number): Promise<void> {
    await this.trekService.deletePlantPhoto(photoId);
    this.collectionService.getCollection().update(list =>
      list.map(p =>
        p.id === plantId
          ? { ...p, photos: p.photos.filter(ph => ph.id !== photoId) }
          : p
      )
    );
  }

  async removePlant(id: number): Promise<void> {
    await this.collectionService.removePlant(id);
  }
}
