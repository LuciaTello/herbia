import { computed, Injectable, signal } from '@angular/core';
import { Lang, Translations } from './translations';
import { ES } from './es';
import { FR } from './fr';

const STORAGE_KEY = 'herbia-lang';

const TRANSLATIONS: Record<Lang, Translations> = { es: ES, fr: FR };

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly currentLang = signal<Lang>(this.loadLang());
  readonly t = computed<Translations>(() => TRANSLATIONS[this.currentLang()]);

  setLang(lang: Lang): void {
    this.currentLang.set(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }

  private loadLang(): Lang {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'es' || stored === 'fr') return stored;
    return 'es';
  }
}
