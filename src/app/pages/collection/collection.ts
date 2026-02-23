import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CollectionService } from '../../services/collection.service';
import { I18nService } from '../../i18n';

@Component({
  selector: 'app-collection',
  imports: [RouterLink],
  templateUrl: './collection.html',
  styleUrl: './collection.css',
})
export class CollectionPage implements OnInit {
  private readonly collectionService = inject(CollectionService);
  protected readonly i18n = inject(I18nService);
  protected readonly collection = this.collectionService.getCollection();
  protected readonly loading = signal(true);

  async ngOnInit(): Promise<void> {
    try {
      await this.collectionService.loadCollection();
    } finally {
      this.loading.set(false);
    }
  }

  async removePlant(id: number): Promise<void> {
    await this.collectionService.removePlant(id);
  }
}
