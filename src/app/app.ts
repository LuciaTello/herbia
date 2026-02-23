import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { I18nService } from './i18n';
import { LangSelector } from './components/lang-selector/lang-selector';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, LangSelector],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly i18n = inject(I18nService);

  constructor() {
    effect(() => {
      document.documentElement.lang = this.i18n.currentLang();
    });
  }
}
