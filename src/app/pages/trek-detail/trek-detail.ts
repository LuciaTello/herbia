import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PlantPhoto, SuggestedPlant, IdentifyAllResult } from '../../models/plant.model';
import { TrekService } from '../../services/trek.service';
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
import { ConnectivityService } from '../../services/connectivity.service';
import { OfflineQueueService } from '../../services/offline-queue.service';

@Component({
  selector: 'app-trek-detail',
  imports: [RouterLink, PhotoGalleryComponent, ConfirmPopupComponent, FamilyPopupComponent, RouteMapComponent],
  templateUrl: './trek-detail.html',
  styleUrl: './trek-detail.css',
})
export class TrekDetailPage implements OnInit {
  private readonly trekService = inject(TrekService);
  protected readonly auth = inject(AuthService);
  private readonly activatedRoute = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  protected readonly cameraService = inject(CameraService);
  protected readonly i18n = inject(I18nService);
  private readonly confirmService = inject(ConfirmService);
  protected readonly connectivity = inject(ConnectivityService);
  private readonly offlineQueue = inject(OfflineQueueService);
  protected readonly treks = this.trekService.getTreks();
  protected readonly loading = signal(true);
  protected readonly galleryImages = signal<string[]>([]);
  protected readonly galleryPlantName = signal('');
  protected readonly selectedFamily = signal<string | null>(null);

  // Identify-all state
  protected readonly identifying = signal(false);
  protected readonly identifyResult = signal<IdentifyAllResult | null>(null);
  protected readonly pendingFile = signal<File | null>(null);
  protected readonly resultOverlay = signal<{ name: string; points: number; type: 'match' | 'noMatch'; photoUrl?: string; identifiedAs?: string; commonName?: string; genus?: string; family?: string } | null>(null);
  protected readonly completedPopup = signal(false);
  protected readonly completingId = signal<number | null>(null);
  protected readonly uploadingPhoto = signal(false);
  protected readonly reactivating = signal(false);
  protected readonly pendingCount = this.offlineQueue.pendingCount;

  private trekId = 0;

  protected readonly trek = computed(() =>
    this.treks().find(m => m.id === this.trekId)
  );

  protected readonly aiPlants = computed(() =>
    (this.trek()?.plants || []).filter(p => p.source !== 'user')
  );

  async ngOnInit(): Promise<void> {
    this.trekId = parseInt(this.activatedRoute.snapshot.paramMap.get('id')!);
    try {
      if (!this.treks().length) {
        await this.trekService.loadTreks();
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

  protected trekPoints(plants: SuggestedPlant[]): number {
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

      if (!this.connectivity.online()) {
        const photoUrl = URL.createObjectURL(file);
        await this.offlineQueue.enqueue(this.trekId, file);
        this.resultOverlay.set({ name: this.i18n.t().offline.photoQueued, points: 0, type: 'noMatch', photoUrl });
        return;
      }

      const photoUrl = URL.createObjectURL(file);
      this.pendingFile.set(file);
      this.identifyResult.set(null);
      this.identifying.set(true);

      try {
        const result = await this.trekService.identifyAll(this.trekId, file);
        const pn = result.plantnetResult;

        const available = result.matches.filter(m => !m.alreadyCaptured);
        if (available.length === 0) {
          await this.addToCollection(file, result, photoUrl, result.matches.length > 0);
        } else if (available.length === 1) {
          await this.confirmUpload(available[0].plantId, available[0].similarity, available[0].commonName, photoUrl, pn);
        } else {
          this.identifyResult.set({ ...result, matches: available });
          URL.revokeObjectURL(photoUrl);
        }
      } catch {
        this.resultOverlay.set({ name: this.i18n.t().myTreks.uploadError, points: 0, type: 'noMatch', photoUrl });
      } finally {
        this.identifying.set(false);
      }
    } catch {
      this.resultOverlay.set({ name: this.i18n.t().myTreks.uploadError, points: 0, type: 'noMatch' });
    }
  }

  private async addToCollection(file: File, result: IdentifyAllResult, photoUrl?: string, matchesFull = false): Promise<void> {
    const pn = result.plantnetResult;
    try {
      const prevResult = pn.identifiedAs
        ? { match: false, score: pn.score, identifiedAs: pn.identifiedAs, commonName: pn.commonName, similarity: 0, genus: pn.genus, family: pn.family }
        : undefined;
      const addResult = await this.trekService.addUserPlant(this.trekId, file, prevResult);
      if (addResult.pointsOnly) {
        // Species limit reached — photo not saved
        const msg = this.i18n.t().myTreks.maxPhotosReached.replace('{points}', '0');
        this.resultOverlay.set({ name: msg, points: 0, type: 'noMatch', photoUrl });
      } else {
        const msg = matchesFull ? this.i18n.t().myTreks.alreadyCaptured : this.i18n.t().myTreks.noMatchInTrek;
        this.resultOverlay.set({ name: msg, points: 0, type: 'noMatch', photoUrl, identifiedAs: pn.identifiedAs, commonName: pn.commonName, genus: pn.genus, family: pn.family });
      }
    } catch (err: any) {
      this.resultOverlay.set({ name: this.i18n.t().myTreks.uploadError, points: 0, type: 'noMatch', photoUrl });
    } finally {
      this.pendingFile.set(null);
    }
  }

  async confirmUpload(plantId: number, similarity: number, plantName?: string, photoUrl?: string, pn?: { identifiedAs: string; commonName: string; genus: string; family: string }): Promise<void> {
    const file = this.pendingFile();
    if (!file) return;

    this.identifyResult.set(null);
    this.uploadingPhoto.set(true);
    try {
      const photo = await this.trekService.uploadPlantPhoto(plantId, file, similarity, pn ? { identifiedAs: pn.identifiedAs, commonName: pn.commonName } : undefined);
      this.trekService.markPlantFoundLocally(plantId);
      if (photo.pointsOnly) {
        // Species limit reached — points awarded but photo not saved
        if (similarity > 0) this.auth.points.update(p => p + similarity);
        const msg = this.i18n.t().myTreks.maxPhotosReached.replace('{points}', String(similarity));
        this.resultOverlay.set({ name: msg, points: similarity, type: 'noMatch', photoUrl });
      } else {
        if (photo.similarity) this.auth.points.update(p => p + photo.similarity!);
        const missionName = plantName || this.treks().flatMap(m => m.plants).find(p => p.id === plantId)?.commonName || '';
        const displayName = pn?.commonName || missionName;
        this.resultOverlay.set({ name: missionName, points: similarity, type: 'match', photoUrl, identifiedAs: pn?.identifiedAs, commonName: displayName, genus: pn?.genus, family: pn?.family });
        await this.checkAutoComplete();
      }
    } catch (err: any) {
      this.resultOverlay.set({ name: this.i18n.t().myTreks.uploadError, points: 0, type: 'noMatch', photoUrl });
    } finally {
      this.uploadingPhoto.set(false);
      this.pendingFile.set(null);
    }
  }

  protected selectMatch(match: { plantId: number; similarity: number; commonName: string }): void {
    const pn = this.identifyResult()?.plantnetResult;
    this.confirmUpload(match.plantId, match.similarity, match.commonName, undefined, pn);
  }

  protected dismissOverlay(): void {
    const r = this.resultOverlay();
    if (r?.photoUrl) URL.revokeObjectURL(r.photoUrl);
    this.resultOverlay.set(null);
  }

  protected matchReason(points: number): string {
    // Points are multiplied by rarity (×1/×2/×3), so base values are 100/75/40
    // Species: 100, 200, 300. Genus: 75, 150, 225. Family: 40, 80, 120.
    if (points > 0 && points % 100 === 0) return this.i18n.t().myTreks.matchSpecies;
    if (points > 0 && points % 75 === 0) return this.i18n.t().myTreks.matchGenus;
    if (points > 0 && points % 40 === 0) return this.i18n.t().myTreks.matchFamily;
    return '';
  }

  protected cancelUpload(): void {
    this.identifyResult.set(null);
    this.pendingFile.set(null);
  }

  async deletePhoto(photoId: number): Promise<void> {
    const ok = await this.confirmService.confirm(this.i18n.t().confirm.deletePhoto);
    if (!ok) return;
    const photo = this.treks().flatMap(m => m.plants).flatMap(p => p.photos).find(p => p.id === photoId);
    const similarity = photo?.similarity ?? 0;
    await this.trekService.deletePlantPhoto(photoId);
    if (similarity > 0) this.auth.points.update(p => Math.max(0, p - similarity));
  }

  async completeTrek(): Promise<void> {
    const trek = this.trek();
    if (!trek) return;
    const ok = await this.confirmService.confirm(this.i18n.t().confirm.completeTrek, false, this.i18n.t().myTreks.completeTrek);
    if (!ok) return;
    this.completingId.set(trek.id);
    await this.trekService.completeTrek(trek.id);
    await new Promise(resolve => setTimeout(resolve, 600));
    this.completingId.set(null);
  }

  async reactivateTrek(): Promise<void> {
    const trek = this.trek();
    if (!trek) return;
    this.reactivating.set(true);
    try {
      await this.trekService.reactivateTrek(trek.id);
    } catch {
      // Ignore — UI stays on completed state
    } finally {
      this.reactivating.set(false);
    }
  }

  async deleteTrek(): Promise<void> {
    const trek = this.trek();
    if (!trek) return;
    const ok = await this.confirmService.confirm(this.i18n.t().confirm.deleteTrek);
    if (!ok) return;
    await this.trekService.deleteTrek(trek.id);
    this.router.navigate(['/my-treks']);
  }

  private async checkAutoComplete(): Promise<void> {
    const trek = this.trek();
    if (!trek || trek.status === 'completed') return;
    const aiPlants = trek.plants.filter(p => p.source !== 'user');
    if (aiPlants.length > 0 && aiPlants.every(p => p.found)) {
      await this.completeTrek();
      this.completedPopup.set(true);
      setTimeout(() => this.completedPopup.set(false), 3500);
    }
  }
}
