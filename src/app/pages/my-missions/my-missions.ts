import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PlantPhoto, IdentifyResult, SuggestedPlant } from '../../models/plant.model';
import { MissionService } from '../../services/mission.service';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../i18n';
import { PhotoGalleryComponent } from '../../components/photo-gallery/photo-gallery';
import { WorldMapComponent } from '../../components/world-map/world-map';
import { getRarity } from '../../utils/rarity';
import { resizeImage } from '../../utils/resize-image';
import { getContinent, getContinentName, countryFlag } from '../../utils/continents';
import { getCountryName } from '../../utils/country-names';
import { CameraService } from '../../services/camera.service';
import { CameraSource } from '@capacitor/camera';

type MapView = 'map' | 'countries' | 'regions' | 'missions';

@Component({
  selector: 'app-my-missions',
  imports: [RouterLink, DatePipe, NgTemplateOutlet, PhotoGalleryComponent, WorldMapComponent],
  templateUrl: './my-missions.html',
  styleUrl: './my-missions.css',
})
export class MyMissionsPage implements OnInit {
  private readonly missionService = inject(MissionService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  protected readonly cameraService = inject(CameraService);
  protected readonly i18n = inject(I18nService);
  protected readonly missions = this.missionService.getMissions();
  protected readonly loading = signal(true);
  protected readonly expandedId = signal<number | null>(null);
  protected readonly galleryImages = signal<string[]>([]);
  protected readonly galleryPlantName = signal('');
  protected readonly uploadingPhotoId = signal<number | null>(null);
  protected readonly identifying = signal<number | null>(null);
  protected readonly pendingFile = signal<File | null>(null);
  protected readonly pendingPlantId = signal<number | null>(null);
  protected readonly identifyResult = signal<IdentifyResult | null>(null);
  protected readonly addingPlantForMission = signal<number | null>(null);
  protected readonly showUnidentifiedFor = signal<number | null>(null);
  protected readonly addPlantMessage = signal<string | null>(null);
  protected readonly completedPopup = signal(false);
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

  protected userPhotos(photos: PlantPhoto[]): PlantPhoto[] {
    return photos.filter(p => p.source === 'user');
  }

  protected refPhotos(photos: PlantPhoto[]): PlantPhoto[] {
    return photos.filter(p => p.source !== 'user');
  }

  protected foundCount(plants: { found: boolean }[]): number {
    return plants.filter(p => p.found).length;
  }

  protected toggle(id: number): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  async ngOnInit(): Promise<void> {
    try {
      await this.missionService.loadMissions();
    } finally {
      this.loading.set(false);
    }
    const openId = Number(this.route.snapshot.queryParamMap.get('open'));
    if (openId) {
      const mission = this.missions().find(m => m.id === openId);
      if (mission?.status === 'completed') {
        this.showCompleted.set(true);
        if (mission.countryCode) {
          const lang = this.i18n.currentLang();
          const continent = getContinent(mission.countryCode);
          if (continent) {
            this.selectedContinent.set(continent);
            this.selectedCountryCode.set(mission.countryCode);
            this.selectedCountry.set(getCountryName(mission.countryCode, lang));
            if (mission.region) this.selectedRegion.set(mission.region);
            this.mapView.set('missions');
          }
        } else {
          this.mapView.set('missions');
        }
      }
      this.expandedId.set(openId);
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

  async onPhotoSelected(event: Event, plantId: number): Promise<void> {
    const input = event.target as HTMLInputElement;
    const raw = input.files?.[0];
    if (!raw) return;
    input.value = '';

    const file = await resizeImage(raw);
    this.pendingFile.set(file);
    this.pendingPlantId.set(plantId);
    this.identifyResult.set(null);
    this.identifying.set(plantId);

    try {
      const result = await this.missionService.identifyPlant(plantId, file);
      this.identifyResult.set(result);
      if (result.similarity > 0) this.auth.points.update(p => p + result.similarity);
    } catch {
      await this.confirmUpload();
    } finally {
      this.identifying.set(null);
    }
  }

  async pickPhoto(plantId: number): Promise<void> {
    let raw: File;
    try {
      raw = await this.cameraService.takePhoto();
    } catch {
      return; // User cancelled the camera/gallery prompt
    }

    try {
      const file = await resizeImage(raw);
      this.pendingFile.set(file);
      this.pendingPlantId.set(plantId);
      this.identifyResult.set(null);
      this.identifying.set(plantId);

      try {
        const result = await this.missionService.identifyPlant(plantId, file);
        this.identifyResult.set(result);
        if (result.similarity > 0) this.auth.points.update(p => p + result.similarity);
      } catch {
        await this.confirmUpload();
      } finally {
        this.identifying.set(null);
      }
    } catch {
      this.addPlantMessage.set(this.i18n.t().myMissions.uploadError);
      setTimeout(() => this.addPlantMessage.set(null), 4000);
    }
  }

  protected pickSource(type: 'camera' | 'gallery'): void {
    this.cameraService.pick(type === 'camera' ? CameraSource.Camera : CameraSource.Photos);
  }

  async confirmUpload(): Promise<void> {
    const file = this.pendingFile();
    const plantId = this.pendingPlantId();
    if (!file || !plantId) return;

    this.identifyResult.set(null);
    this.uploadingPhotoId.set(plantId);
    try {
      await this.missionService.uploadPlantPhoto(plantId, file);
    } catch {
      this.addPlantMessage.set(this.i18n.t().myMissions.uploadError);
      setTimeout(() => this.addPlantMessage.set(null), 4000);
    } finally {
      this.uploadingPhotoId.set(null);
      this.pendingFile.set(null);
      this.pendingPlantId.set(null);
    }
  }

  async addPendingAsUserPlant(): Promise<void> {
    const file = this.pendingFile();
    const plantId = this.pendingPlantId();
    if (!file || !plantId) return;

    // Find which mission this plant belongs to
    const mission = this.missions().find(m => m.plants.some(p => p.id === plantId));
    if (!mission) return;

    const prevResult = this.identifyResult()!;
    this.identifyResult.set(null);
    this.pendingFile.set(null);
    this.pendingPlantId.set(null);
    this.addingPlantForMission.set(mission.id);
    this.addPlantMessage.set(null);

    try {
      await this.missionService.addUserPlant(mission.id, file, prevResult);
      this.addPlantMessage.set(this.i18n.t().myMissions.plantAdded);
      setTimeout(() => this.addPlantMessage.set(null), 3000);
      await this.checkAutoComplete();
    } catch (err: any) {
      if (err?.status === 409) {
        this.addPlantMessage.set(this.i18n.t().myMissions.maxPhotosReached);
      } else {
        this.addPlantMessage.set(this.i18n.t().myMissions.uploadError);
      }
      setTimeout(() => this.addPlantMessage.set(null), 4000);
    } finally {
      this.addingPlantForMission.set(null);
    }
  }

  cancelUpload(): void {
    this.pendingFile.set(null);
    this.pendingPlantId.set(null);
    this.identifyResult.set(null);
  }

  async deletePhoto(photoId: number): Promise<void> {
    await this.missionService.deletePlantPhoto(photoId);
  }

  async markFound(plantId: number): Promise<void> {
    await this.missionService.markPlantFound(plantId);
    await this.checkAutoComplete();
  }

  async completeMission(id: number): Promise<void> {
    this.completingId.set(id);
    await this.missionService.completeMission(id);
    await new Promise(resolve => setTimeout(resolve, 600));
    this.completingId.set(null);
  }

  async deleteMission(id: number): Promise<void> {
    await this.missionService.deleteMission(id);
  }

  async deleteUserPlant(plantId: number): Promise<void> {
    await this.missionService.deleteUserPlant(plantId);
  }

  protected aiPlants(plants: SuggestedPlant[]): SuggestedPlant[] {
    return plants.filter(p => p.source !== 'user');
  }

  protected userPlants(plants: SuggestedPlant[]): SuggestedPlant[] {
    return plants.filter(p => p.source === 'user' && p.scientificName !== '');
  }

  private async checkAutoComplete(): Promise<void> {
    for (const mission of this.missions()) {
      if (mission.status === 'completed') continue;
      const aiPlants = mission.plants.filter(p => p.source !== 'user');
      if (aiPlants.length > 0 && aiPlants.every(p => p.found)) {
        await this.completeMission(mission.id);
        this.completedPopup.set(true);
        setTimeout(() => this.completedPopup.set(false), 3500);
      }
    }
  }

  protected unidentifiedPlants(plants: SuggestedPlant[]): SuggestedPlant[] {
    return plants.filter(p => p.source === 'user' && p.scientificName === '');
  }

  protected toggleUnidentified(missionId: number): void {
    this.showUnidentifiedFor.set(this.showUnidentifiedFor() === missionId ? null : missionId);
  }

  async onAddPlant(event: Event, missionId: number): Promise<void> {
    const input = event.target as HTMLInputElement;
    const raw = input.files?.[0];
    if (!raw) return;
    input.value = '';

    const file = await resizeImage(raw);
    this.addingPlantForMission.set(missionId);
    this.addPlantMessage.set(null);

    try {
      const result = await this.missionService.addUserPlant(missionId, file);
      this.addPlantMessage.set(this.i18n.t().myMissions.plantAdded);
      setTimeout(() => this.addPlantMessage.set(null), 3000);
      await this.checkAutoComplete();
    } catch (err: any) {
      if (err?.status === 409) {
        this.addPlantMessage.set(this.i18n.t().myMissions.maxPhotosReached);
      } else {
        this.addPlantMessage.set(this.i18n.t().myMissions.uploadError);
      }
      setTimeout(() => this.addPlantMessage.set(null), 4000);
    } finally {
      this.addingPlantForMission.set(null);
    }
  }
}
