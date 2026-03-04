import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { PlantPhoto, SuggestedPlant } from '../../models/plant.model';
import { MissionService } from '../../services/mission.service';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../i18n';
import { WorldMapComponent } from '../../components/world-map/world-map';
import { getRarity } from '../../utils/rarity';
import { getContinent, getContinentName, countryFlag } from '../../utils/continents';
import { getCountryName } from '../../utils/country-names';
import { ConfirmService } from '../../components/confirm-popup/confirm.service';
import { ConfirmPopupComponent } from '../../components/confirm-popup/confirm-popup';

type MapView = 'map' | 'countries' | 'regions' | 'missions';

@Component({
  selector: 'app-my-missions',
  imports: [RouterLink, DatePipe, NgTemplateOutlet, WorldMapComponent, ConfirmPopupComponent],
  templateUrl: './my-missions.html',
  styleUrl: './my-missions.css',
})
export class MyMissionsPage implements OnInit {
  private readonly missionService = inject(MissionService);
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);
  protected readonly i18n = inject(I18nService);
  private readonly confirmService = inject(ConfirmService);
  protected readonly missions = this.missionService.getMissions();
  protected readonly loading = signal(true);
  protected readonly completingId = signal<number | null>(null);

  // Top-level toggle: active missions list vs completed missions map
  protected readonly showCompleted = signal(false);

  // Drill-down state (only used in completed tab)
  protected readonly mapView = signal<MapView>('map');
  protected readonly selectedContinent = signal<string | null>(null);
  protected readonly selectedCountry = signal<string | null>(null);
  protected readonly selectedCountryCode = signal<string | null>(null);
  protected readonly selectedRegion = signal<string | null>(null);

  // --- Active missions (flat list, newest first) ---
  protected readonly activeMissions = computed(() =>
    this.missions()
      .filter(m => m.status !== 'completed' || m.id === this.completingId())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  );

  // --- Completed missions drill-down ---
  private readonly completedMissions = computed(() =>
    this.missions().filter(m => m.status === 'completed')
  );

  private readonly locatedCompleted = computed(() =>
    this.completedMissions().filter(m => m.countryCode)
  );

  protected readonly noLocationCompleted = computed(() =>
    this.completedMissions().filter(m => !m.countryCode)
  );

  protected readonly continentCounts = computed(() => {
    const counts: Record<string, number> = {};
    for (const m of this.locatedCompleted()) {
      const continent = getContinent(m.countryCode!);
      if (continent) {
        counts[continent] = (counts[continent] || 0) + 1;
      }
    }
    return counts;
  });

  protected readonly countriesInContinent = computed(() => {
    const continent = this.selectedContinent();
    if (!continent) return [];
    const lang = this.i18n.currentLang();
    const countryMap = new Map<string, { code: string; name: string; flag: string; count: number }>();
    for (const m of this.locatedCompleted()) {
      const code = m.countryCode!;
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

  protected readonly completedInCountry = computed(() => {
    const code = this.selectedCountryCode();
    if (!code) return [];
    return this.locatedCompleted().filter(m => m.countryCode === code);
  });

  protected readonly regionsInCountry = computed(() => {
    const regionMap = new Map<string, { name: string; count: number }>();
    for (const m of this.completedInCountry()) {
      const regionName = m.region || '?';
      const existing = regionMap.get(regionName);
      if (existing) {
        existing.count++;
      } else {
        regionMap.set(regionName, { name: regionName, count: 1 });
      }
    }
    return [...regionMap.values()].sort((a, b) => b.count - a.count);
  });

  protected readonly completedInView = computed(() => {
    const code = this.selectedCountryCode();
    const region = this.selectedRegion();
    if (this.mapView() === 'missions' && !code) {
      return this.noLocationCompleted();
    }
    if (!code) return [];
    return this.locatedCompleted()
      .filter(m => {
        if (m.countryCode !== code) return false;
        if (region) return (m.region || '?') === region;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  });

  protected readonly breadcrumb = computed(() => {
    const lang = this.i18n.currentLang();
    const parts: { label: string; action: MapView | null }[] = [];
    parts.push({ label: this.i18n.t().collection.mapTitle, action: 'map' });

    const v = this.mapView();
    if (v === 'map') return parts;

    if (v === 'missions' && !this.selectedCountryCode()) {
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

  protected rarity(rarity: string) { return getRarity(rarity, this.i18n.t()); }

  protected missionPoints(plants: SuggestedPlant[]): number {
    return plants.flatMap(p => p.photos).reduce((sum, ph) => sum + (ph.similarity || 0), 0);
  }

  protected foundCount(plants: { found: boolean }[]): number {
    return plants.filter(p => p.found).length;
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.missionService.loadMissions();
    } finally {
      this.loading.set(false);
    }
  }

  protected switchToCompleted(): void {
    this.showCompleted.set(true);
    this.resetMapState();
  }

  protected switchToActive(): void {
    this.showCompleted.set(false);
    this.resetMapState();
  }

  private resetMapState(): void {
    this.mapView.set('map');
    this.selectedContinent.set(null);
    this.selectedCountry.set(null);
    this.selectedCountryCode.set(null);
    this.selectedRegion.set(null);
  }

  protected onContinentSelected(continentId: string): void {
    this.selectedContinent.set(continentId);
    this.selectedCountry.set(null);
    this.selectedCountryCode.set(null);
    this.selectedRegion.set(null);
    this.mapView.set('countries');
  }

  protected onCountrySelected(code: string, name: string): void {
    this.selectedCountryCode.set(code);
    this.selectedCountry.set(name);
    this.selectedRegion.set(null);
    this.mapView.set('regions');
  }

  protected onRegionSelected(region: string): void {
    this.selectedRegion.set(region);
    this.mapView.set('missions');
  }

  protected onShowAllFromCountry(): void {
    this.selectedRegion.set(null);
    this.mapView.set('missions');
  }

  protected onShowNoLocation(): void {
    this.selectedContinent.set(null);
    this.selectedCountry.set(null);
    this.selectedCountryCode.set(null);
    this.selectedRegion.set(null);
    this.mapView.set('missions');
  }

  protected navigateTo(action: MapView | null): void {
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
    this.mapView.set(action);
  }

  protected openMission(id: number): void {
    this.router.navigate(['/my-missions', id]);
  }

  async deleteMission(id: number, event: Event): Promise<void> {
    event.stopPropagation();
    const ok = await this.confirmService.confirm(this.i18n.t().confirm.deleteMission);
    if (!ok) return;
    await this.missionService.deleteMission(id);
  }
}
