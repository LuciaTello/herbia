import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../i18n';
import { TrekTutorialComponent } from '../../components/trek-tutorial/trek-tutorial';
import { TaxonomyTutorialComponent } from '../../components/taxonomy-tutorial/taxonomy-tutorial';
import { FamiliesTutorialComponent } from '../../components/families-tutorial/families-tutorial';

@Component({
  selector: 'app-tutorials',
  imports: [RouterLink, TrekTutorialComponent, TaxonomyTutorialComponent, FamiliesTutorialComponent],
  templateUrl: './tutorials.html',
  styleUrl: './tutorials.css',
})
export class TutorialsPage {
  protected readonly i18n = inject(I18nService);
  protected readonly activeTutorial = signal<'treks' | 'taxonomy' | 'families' | null>(null);

  protected open(id: 'treks' | 'taxonomy' | 'families'): void {
    this.activeTutorial.set(id);
  }

  protected close(): void {
    this.activeTutorial.set(null);
  }
}
