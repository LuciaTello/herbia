import { computed, Injectable, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';

const PREF_KEY = 'herbia.manualOfflineMode';

@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  readonly online = signal(navigator.onLine);
  readonly manualOfflineMode = signal(false);
  readonly isOffline = computed(() => this.manualOfflineMode());

  constructor() {
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
  }

  async initManualMode(): Promise<void> {
    const { value } = await Preferences.get({ key: PREF_KEY });
    this.manualOfflineMode.set(value === 'true');
  }

  async setManualOffline(value: boolean): Promise<void> {
    this.manualOfflineMode.set(value);
    await Preferences.set({ key: PREF_KEY, value: String(value) });
  }
}
