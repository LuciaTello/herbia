import { Component, effect, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { I18nService } from './i18n';
import { LangSelector } from './components/lang-selector/lang-selector';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, LangSelector],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);

  constructor() {
    effect(() => {
      document.documentElement.lang = this.i18n.currentLang();
    });
  }
}
