import { Component, inject } from '@angular/core';
import { I18nService } from '../../i18n';

@Component({
  selector: 'app-lang-selector',
  template: `
    <div class="lang-selector">
      <button
        [class.active]="i18n.currentLang() === 'es'"
        (click)="i18n.setLang('es')"
      >ES</button>
      <button
        [class.active]="i18n.currentLang() === 'fr'"
        (click)="i18n.setLang('fr')"
      >FR</button>
    </div>
  `,
  styles: `
    .lang-selector {
      display: flex;
      gap: 0.25rem;
    }

    button {
      padding: 0.25rem 0.5rem;
      border: 1px solid rgba(255, 255, 255, 0.3);
      border-radius: 4px;
      background: transparent;
      color: inherit;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 500;
      transition: background 0.2s, border-color 0.2s;
    }

    button:hover {
      background: rgba(255, 255, 255, 0.1);
    }

    button.active {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(255, 255, 255, 0.6);
    }
  `,
})
export class LangSelector {
  protected readonly i18n = inject(I18nService);
}
