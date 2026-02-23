import { Component, inject, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TrekService } from '../../services/trek.service';
import { I18nService } from '../../i18n';

@Component({
  selector: 'app-my-treks',
  imports: [RouterLink, DatePipe],
  templateUrl: './my-treks.html',
  styleUrl: './my-treks.css',
})
export class MyTreksPage implements OnInit {
  private readonly trekService = inject(TrekService);
  protected readonly i18n = inject(I18nService);
  protected readonly treks = this.trekService.getTreks();
  protected readonly loading = signal(true);

  async ngOnInit(): Promise<void> {
    try {
      await this.trekService.loadTreks();
    } finally {
      this.loading.set(false);
    }
  }

  async markFound(plantId: number): Promise<void> {
    await this.trekService.markPlantFound(plantId);
  }

  async deleteTrek(id: number): Promise<void> {
    await this.trekService.deleteTrek(id);
  }
}
