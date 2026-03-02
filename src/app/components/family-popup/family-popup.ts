import { Component, inject, input, output, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { I18nService } from '../../i18n';
import { environment } from '../../../environments/environment';

interface FamilyPlant {
  scientificName: string;
  commonName: string;
  photoUrl: string | null;
  genus: string;
}

@Component({
  selector: 'app-family-popup',
  templateUrl: './family-popup.html',
  styleUrl: './family-popup.css',
})
export class FamilyPopupComponent implements OnInit {
  private readonly http = inject(HttpClient);
  protected readonly i18n = inject(I18nService);

  readonly family = input.required<string>();
  readonly close = output<void>();

  protected readonly loading = signal(true);
  protected readonly plants = signal<FamilyPlant[]>([]);

  async ngOnInit(): Promise<void> {
    try {
      const url = `${environment.apiUrl}/plants/family/${encodeURIComponent(this.family())}`;
      const result = await firstValueFrom(this.http.get<FamilyPlant[]>(url));
      this.plants.set(result);
    } catch {
      this.plants.set([]);
    } finally {
      this.loading.set(false);
    }
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.close.emit();
    }
  }
}
