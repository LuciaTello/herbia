import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../i18n';
import { TrekTutorialComponent } from '../../components/trek-tutorial/trek-tutorial';
import { TaxonomyTutorialComponent } from '../../components/taxonomy-tutorial/taxonomy-tutorial';
import { FamiliesTutorialComponent } from '../../components/families-tutorial/families-tutorial';
import { OnboardingComponent } from '../../components/onboarding/onboarding';

@Component({
  selector: 'app-tutorials',
  imports: [RouterLink, TrekTutorialComponent, TaxonomyTutorialComponent, FamiliesTutorialComponent, OnboardingComponent],
  templateUrl: './tutorials.html',
  styleUrl: './tutorials.css',
})
export class TutorialsPage {
  protected readonly i18n = inject(I18nService);
  protected readonly activeTutorial = signal<'intro' | 'treks' | 'taxonomy' | 'families' | null>(null);

  protected open(id: 'intro' | 'treks' | 'taxonomy' | 'families'): void {
    this.activeTutorial.set(id);
  }

  protected close(): void {
    this.activeTutorial.set(null);
  }
}
