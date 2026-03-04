import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PlantPhoto, SuggestedPlant, IdentifyAllResult } from '../../models/plant.model';
import { MissionService } from '../../services/mission.service';
import { AuthService } from '../../services/auth.service';
import { I18nService } from '../../i18n';
import { PhotoGalleryComponent } from '../../components/photo-gallery/photo-gallery';
import { getRarity } from '../../utils/rarity';
import { resizeImage } from '../../utils/resize-image';
import { CameraService } from '../../services/camera.service';
import { CameraSource } from '@capacitor/camera';
import { ConfirmService } from '../../components/confirm-popup/confirm.service';
import { ConfirmPopupComponent } from '../../components/confirm-popup/confirm-popup';
import { FamilyPopupComponent } from '../../components/family-popup/family-popup';
import { RouteMapComponent } from '../../components/route-map/route-map';

@Component({
  selector: 'app-mission-detail',
  imports: [RouterLink, PhotoGalleryComponent, ConfirmPopupComponent, FamilyPopupComponent, RouteMapComponent],
  templateUrl: './mission-detail.html',
  styleUrl: './mission-detail.css',
})
export class MissionDetailPage implements OnInit {
  private readonly missionService = inject(MissionService);
  protected readonly auth = inject(AuthService);
  private readonly activatedRoute = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  protected readonly cameraService = inject(CameraService);
  protected readonly i18n = inject(I18nService);
  private readonly confirmService = inject(ConfirmService);
  protected readonly missions = this.missionService.getMissions();
  protected readonly loading = signal(true);
  protected readonly galleryImages = signal<string[]>([]);
  protected readonly galleryPlantName = signal('');
  protected readonly selectedFamily = signal<string | null>(null);

  // Identify-all state
  protected readonly identifying = signal(false);
  protected readonly identifyResult = signal<IdentifyAllResult | null>(null);
  protected readonly pendingFile = signal<File | null>(null);
  protected readonly addPlantMessage = signal<string | null>(null);
  protected readonly completedPopup = signal(false);
  protected readonly completingId = signal<number | null>(null);
  protected readonly uploadingPhoto = signal(false);

  private missionId = 0;

  protected readonly mission = computed(() =>
    this.missions().find(m => m.id === this.missionId)
  );

  protected readonly aiPlants = computed(() =>
    (this.mission()?.plants || []).filter(p => p.source !== 'user')
  );

  async ngOnInit(): Promise<void> {
    this.missionId = parseInt(this.activatedRoute.snapshot.paramMap.get('id')!);
    try {
      if (!this.missions().length) {
        await this.missionService.loadMissions();
      }
    } finally {
      this.loading.set(false);
    }
  }

  protected rarity(rarity: string) { return getRarity(rarity, this.i18n.t()); }

  protected userPhotos(photos: PlantPhoto[]): PlantPhoto[] {
    return photos.filter(p => p.source === 'user');
  }

  protected refPhotos(photos: PlantPhoto[]): PlantPhoto[] {
    return photos.filter(p => p.source !== 'user');
  }

  protected missionPoints(plants: SuggestedPlant[]): number {
    return plants.flatMap(p => p.photos).reduce((sum, ph) => sum + (ph.similarity || 0), 0);
  }

  protected foundCount(plants: SuggestedPlant[]): number {
    return plants.filter(p => p.found).length;
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

  protected openFamily(family: string): void {
    this.selectedFamily.set(family);
  }

  protected closeFamily(): void {
    this.selectedFamily.set(null);
  }

  protected pickSource(type: 'camera' | 'gallery'): void {
    this.cameraService.pick(type === 'camera' ? CameraSource.Camera : CameraSource.Photos);
  }

  async takePhoto(): Promise<void> {
    let raw: File;
    try {
      raw = await this.cameraService.takePhoto();
    } catch {
      return; // User cancelled
    }

    try {
      const file = await resizeImage(raw);
      this.pendingFile.set(file);
      this.identifyResult.set(null);
      this.identifying.set(true);

      try {
        const result = await this.missionService.identifyAll(this.missionId, file);
        this.identifying.set(false);

        if (result.matches.length === 0) {
          // No match — add to collection directly
          await this.addToCollection(file, result);
        } else if (result.matches.length === 1) {
          // Single match — assign directly
          const m = result.matches[0];
          await this.confirmUpload(m.plantId, m.similarity, m.commonName);
        } else {
          // Multiple matches — show popup
          this.identifyResult.set(result);
        }
      } catch {
        this.identifying.set(false);
        this.addPlantMessage.set(this.i18n.t().myMissions.uploadError);
        setTimeout(() => this.addPlantMessage.set(null), 4000);
      }
    } catch {
      this.addPlantMessage.set(this.i18n.t().myMissions.uploadError);
      setTimeout(() => this.addPlantMessage.set(null), 4000);
    }
  }

  private async addToCollection(file: File, result: IdentifyAllResult): Promise<void> {
    try {
      const prevResult = result.plantnetResult.identifiedAs
        ? { match: false, score: result.plantnetResult.score, identifiedAs: result.plantnetResult.identifiedAs, commonName: result.plantnetResult.commonName, similarity: 0, genus: result.plantnetResult.genus, family: result.plantnetResult.family }
        : undefined;
      await this.missionService.addUserPlant(this.missionId, file, prevResult);
      this.addPlantMessage.set(this.i18n.t().myMissions.noMatchInMission);
      setTimeout(() => this.addPlantMessage.set(null), 4000);
    } catch (err: any) {
      if (err?.status === 409) {
        this.addPlantMessage.set(this.i18n.t().myMissions.maxPhotosReached);
      } else {
        this.addPlantMessage.set(this.i18n.t().myMissions.uploadError);
      }
      setTimeout(() => this.addPlantMessage.set(null), 4000);
    } finally {
      this.pendingFile.set(null);
    }
  }

  async confirmUpload(plantId: number, similarity: number, plantName?: string): Promise<void> {
    const file = this.pendingFile();
    if (!file) return;

    this.identifyResult.set(null);
    this.uploadingPhoto.set(true);
    try {
      const photo = await this.missionService.uploadPlantPhoto(plantId, file, similarity);
      if (photo.similarity) this.auth.points.update(p => p + photo.similarity!);
      this.missionService.markPlantFoundLocally(plantId);
      // Show success toast
      const name = plantName || this.missions().flatMap(m => m.plants).find(p => p.id === plantId)?.commonName || '';
      this.addPlantMessage.set(this.i18n.t().myMissions.pointsFor(name, similarity));
      setTimeout(() => this.addPlantMessage.set(null), 4000);
      await this.checkAutoComplete();
    } catch (err: any) {
      if (err?.status === 409) {
        this.addPlantMessage.set(this.i18n.t().myMissions.maxPhotosReached);
      } else {
        this.addPlantMessage.set(this.i18n.t().myMissions.uploadError);
      }
      setTimeout(() => this.addPlantMessage.set(null), 4000);
    } finally {
      this.uploadingPhoto.set(false);
      this.pendingFile.set(null);
    }
  }

  protected selectMatch(match: { plantId: number; similarity: number; commonName: string }): void {
    this.confirmUpload(match.plantId, match.similarity, match.commonName);
  }

  protected cancelUpload(): void {
    this.identifyResult.set(null);
    this.pendingFile.set(null);
  }

  async deletePhoto(photoId: number): Promise<void> {
    const ok = await this.confirmService.confirm(this.i18n.t().confirm.deletePhoto);
    if (!ok) return;
    const photo = this.missions().flatMap(m => m.plants).flatMap(p => p.photos).find(p => p.id === photoId);
    const similarity = photo?.similarity ?? 0;
    await this.missionService.deletePlantPhoto(photoId);
    if (similarity > 0) this.auth.points.update(p => Math.max(0, p - similarity));
  }

  async completeMission(): Promise<void> {
    const mission = this.mission();
    if (!mission) return;
    const ok = await this.confirmService.confirm(this.i18n.t().confirm.completeMission, false, this.i18n.t().myMissions.completeMission);
    if (!ok) return;
    this.completingId.set(mission.id);
    await this.missionService.completeMission(mission.id);
    await new Promise(resolve => setTimeout(resolve, 600));
    this.completingId.set(null);
  }

  async deleteMission(): Promise<void> {
    const mission = this.mission();
    if (!mission) return;
    const ok = await this.confirmService.confirm(this.i18n.t().confirm.deleteMission);
    if (!ok) return;
    await this.missionService.deleteMission(mission.id);
    this.router.navigate(['/my-missions']);
  }

  private async checkAutoComplete(): Promise<void> {
    const mission = this.mission();
    if (!mission || mission.status === 'completed') return;
    const aiPlants = mission.plants.filter(p => p.source !== 'user');
    if (aiPlants.length > 0 && aiPlants.every(p => p.found)) {
      await this.completeMission();
      this.completedPopup.set(true);
      setTimeout(() => this.completedPopup.set(false), 3500);
    }
  }
}
