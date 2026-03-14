import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { I18nService } from '../../i18n';
import { AuthService } from '../../services/auth.service';
import { TrekService } from '../../services/trek.service';
import { OfflineQueueService, QueuedPhoto } from '../../services/offline-queue.service';
import { IdentifyAllResult } from '../../models/plant.model';

interface SyncItem {
  queued: QueuedPhoto;
  thumbnailUrl: string | null;
  trekName: string;
  selected: boolean;
}

type SyncState = 'list' | 'syncing' | 'result' | 'done';

interface ResultOverlay {
  type: 'match' | 'multipleMatches' | 'noMatch';
  photoUrl?: string;
  plantName?: string;
  commonName?: string;
  identifiedAs?: string;
  genus?: string;
  family?: string;
  points: number;
  matches?: Array<{ plantId: number; similarity: number; commonName: string }>;
  plantnetResult?: IdentifyAllResult['plantnetResult'];
}

@Component({
  selector: 'app-sync',
  imports: [DatePipe],
  templateUrl: './sync.html',
  styleUrl: './sync.css',
})
export class SyncPage implements OnInit {
  protected readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly trekService = inject(TrekService);
  private readonly offlineQueue = inject(OfflineQueueService);
  private readonly router = inject(Router);

  protected readonly state = signal<SyncState>('list');
  protected readonly items = signal<SyncItem[]>([]);
  protected readonly currentIndex = signal(0);
  protected readonly currentResult = signal<ResultOverlay | null>(null);
  protected readonly addedCount = signal(0);
  protected readonly skippedCount = signal(0);
  protected readonly networkError = signal(false);
  protected readonly processing = signal(false);
  protected readonly totalToProcess = signal(0);

  protected toProcess: SyncItem[] = [];
  private currentFile: File | null = null;
  private currentQueuedId: number | null = null;
  private resolveAction: (() => void) | null = null;

  async ngOnInit(): Promise<void> {
    await this.offlineQueue.refreshQueue();
    // Load treks if needed
    if (!this.trekService.getTreks()().length) {
      await this.trekService.loadTreks().catch(() => {});
    }
    await this.buildItemList();
  }

  private async buildItemList(): Promise<void> {
    const treks = this.trekService.getTreks()();
    const queue = this.offlineQueue.queue();
    const built: SyncItem[] = [];

    for (const q of queue) {
      const trek = treks.find(t => t.id === q.trekId);
      const trekName = trek
        ? (trek.origin === trek.destination ? trek.origin : `${trek.origin} → ${trek.destination}`)
        : `#${q.trekId}`;

      let thumbnailUrl: string | null = null;
      try {
        const file = await this.offlineQueue.loadFile(q.filename);
        thumbnailUrl = URL.createObjectURL(file);
      } catch { /* file may be gone */ }

      built.push({ queued: q, thumbnailUrl, trekName, selected: true });
    }
    this.items.set(built);
  }

  protected toggleSelect(index: number): void {
    this.items.update(list => list.map((item, i) =>
      i === index ? { ...item, selected: !item.selected } : item
    ));
  }

  protected toggleAll(): void {
    const allSelected = this.items().every(i => i.selected);
    this.items.update(list => list.map(i => ({ ...i, selected: !allSelected })));
  }

  protected get selectedCount(): number {
    return this.items().filter(i => i.selected).length;
  }

  protected get allSelected(): boolean {
    return this.items().length > 0 && this.items().every(i => i.selected);
  }

  protected async startSync(): Promise<void> {
    this.toProcess = this.items().filter(i => i.selected);
    if (!this.toProcess.length) return;

    this.state.set('syncing');
    this.addedCount.set(0);
    this.skippedCount.set(0);
    this.currentIndex.set(0);
    this.totalToProcess.set(this.toProcess.length);

    for (let i = 0; i < this.toProcess.length; i++) {
      this.currentIndex.set(i + 1);
      const item = this.toProcess[i];
      this.currentQueuedId = item.queued.id!;

      // Load file
      let file: File;
      try {
        file = await this.offlineQueue.loadFile(item.queued.filename);
      } catch {
        await this.offlineQueue.dequeue(item.queued.id!);
        this.skippedCount.update(n => n + 1);
        continue;
      }

      this.currentFile = file;
      const photoUrl = URL.createObjectURL(file);

      // Identify
      this.processing.set(true);
      let result: IdentifyAllResult;
      try {
        result = await this.trekService.identifyAll(item.queued.trekId, file);
      } catch {
        // Network error — stop sync
        URL.revokeObjectURL(photoUrl);
        this.processing.set(false);
        this.networkError.set(true);
        return;
      }
      this.processing.set(false);

      const pn = result.plantnetResult;
      const available = result.matches.filter(m => !m.alreadyCaptured);

      let overlay: ResultOverlay;
      if (available.length === 0) {
        overlay = {
          type: 'noMatch',
          photoUrl,
          identifiedAs: pn?.identifiedAs,
          commonName: pn?.commonName,
          genus: pn?.genus,
          family: pn?.family,
          points: 0,
          plantnetResult: pn,
        };
      } else if (available.length === 1) {
        overlay = {
          type: 'match',
          photoUrl,
          plantName: available[0].commonName,
          commonName: pn?.commonName || available[0].commonName,
          identifiedAs: pn?.identifiedAs,
          genus: pn?.genus,
          family: pn?.family,
          points: available[0].similarity,
          matches: available,
          plantnetResult: pn,
        };
      } else {
        overlay = {
          type: 'multipleMatches',
          photoUrl,
          identifiedAs: pn?.identifiedAs,
          points: 0,
          matches: available,
          plantnetResult: pn,
        };
      }

      // Show result and wait for user action
      this.currentResult.set(overlay);
      this.state.set('result');
      await new Promise<void>(resolve => { this.resolveAction = resolve; });
      this.state.set('syncing');
    }

    // Reload treks after sync
    await this.trekService.loadTreks().catch(() => {});
    await this.offlineQueue.refreshQueue();
    this.state.set('done');
  }

  protected async confirmMatch(plantId: number, similarity: number): Promise<void> {
    if (!this.currentFile) { this.advance(); return; }
    try {
      const pn = this.currentResult()?.plantnetResult;
      await this.trekService.uploadPlantPhoto(
        plantId,
        this.currentFile,
        similarity,
        pn ? { identifiedAs: pn.identifiedAs, commonName: pn.commonName } : undefined,
      );
      this.trekService.markPlantFoundLocally(plantId);
      this.auth.points.update(p => p + similarity);
      this.auth.refreshProfile().catch(() => {});
      this.addedCount.update(n => n + 1);
    } catch {
      this.skippedCount.update(n => n + 1);
    }
    await this.offlineQueue.dequeue(this.currentQueuedId!);
    this.advance();
  }

  protected async confirmAddToCollection(): Promise<void> {
    if (!this.currentFile) { this.advance(); return; }
    try {
      const pn = this.currentResult()?.plantnetResult;
      const prevResult = pn?.identifiedAs
        ? { match: false, score: pn.score, identifiedAs: pn.identifiedAs, commonName: pn.commonName, similarity: 0, genus: pn.genus, family: pn.family }
        : undefined;
      await this.trekService.addUserPlant(this.toProcess[this.currentIndex() - 1].queued.trekId, this.currentFile, prevResult);
      this.addedCount.update(n => n + 1);
    } catch {
      this.skippedCount.update(n => n + 1);
    }
    await this.offlineQueue.dequeue(this.currentQueuedId!);
    this.advance();
  }

  protected skip(): void {
    const r = this.currentResult();
    if (r?.photoUrl) URL.revokeObjectURL(r.photoUrl);
    this.currentResult.set(null);
    this.skippedCount.update(n => n + 1);
    this.advance();
  }

  private advance(): void {
    const r = this.currentResult();
    if (r?.photoUrl) URL.revokeObjectURL(r.photoUrl);
    this.currentResult.set(null);
    this.currentFile = null;
    this.resolveAction?.();
    this.resolveAction = null;
  }

  protected goBack(): void {
    this.router.navigate(['/my-treks']);
  }
}
