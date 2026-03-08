// AuthService: manages login/register, JWT storage, and current user state
// Like a combination of AuthenticationManager + SecurityContext in Spring
//
// Same patterns as CollectionService: inject(), signals, firstValueFrom()

import { inject, Injectable, Injector, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { Preferences } from '@capacitor/preferences';
import { environment } from '../../environments/environment';
import { AuthResponse } from '../models/auth.model';
import { I18nService } from '../i18n';
import { TrekService } from './trek.service';
import { CollectionService } from './collection.service';

const TOKEN_KEY = 'herbia-token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly injector = inject(Injector);
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  // Token signal — initialized to null, loaded from native storage by init()
  private readonly token = signal<string | null>(null);

  // Computed signal: true if logged in
  // Like checking SecurityContextHolder.getContext().getAuthentication() != null
  // Any template reading isLoggedIn() will automatically update when token changes
  readonly isLoggedIn = computed(() => this.token() !== null);

  // In-memory only: true right after register, false otherwise
  readonly justRegistered = signal(false);

  // How many times the user has seen the trek tip (show until 4)
  readonly trekTipCount = signal(4); // default 4 = don't show

  readonly username = signal<string | null>(null);
  readonly points = signal(0);
  readonly quizUnlocked = signal(false);
  readonly photoUrl = signal<string | null>(null);
  readonly bio = signal<string | null>(null);
  readonly email = signal<string | null>(null);
  readonly quizPopupShown = signal(false);

  // Called by APP_INITIALIZER before routing — loads token from native storage
  async init(): Promise<void> {
    const { value } = await Preferences.get({ key: TOKEN_KEY });
    if (value) this.token.set(value);
  }

  getToken(): string | null {
    return this.token();
  }

  async checkEmail(email: string): Promise<{ exists: boolean; lang?: string }> {
    return firstValueFrom(
      this.http.post<{ exists: boolean; lang?: string }>(`${this.apiUrl}/check-email`, { email })
    );
  }

  async register(email: string, password: string, lang: string, username?: string): Promise<void> {
    const result = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.apiUrl}/register`, { email, password, lang, username: username || undefined })
    );
    this.i18n.setLang(lang as 'es' | 'fr');
    this.justRegistered.set(true);
    this.trekTipCount.set(result.user.trekTipCount);
    this.username.set(result.user.username);
    this.points.set(result.user.points);
    this.quizUnlocked.set(result.user.quizUnlocked);
    this.photoUrl.set(result.user.photoUrl);
    this.bio.set(result.user.bio);
    this.email.set(result.user.email);
    this.setToken(result.token);
  }

  async login(email: string, password: string): Promise<void> {
    const result = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password })
    );
    this.i18n.setLang(result.user.lang as 'es' | 'fr');
    this.trekTipCount.set(result.user.trekTipCount);
    this.username.set(result.user.username);
    this.points.set(result.user.points);
    this.quizUnlocked.set(result.user.quizUnlocked);
    this.photoUrl.set(result.user.photoUrl);
    this.bio.set(result.user.bio);
    this.email.set(result.user.email);
    this.setToken(result.token);
  }

  async dismissTrekTip(): Promise<void> {
    this.trekTipCount.update(c => c + 1);
    await firstValueFrom(
      this.http.patch(`${environment.apiUrl}/users/me`, { incrementTrekTip: true })
    );
  }

  async updateUsername(username: string): Promise<void> {
    const result = await firstValueFrom(
      this.http.patch<{ id: number; username: string; points: number }>(`${environment.apiUrl}/users/me`, { username })
    );
    this.username.set(result.username);
  }

  async refreshProfile(): Promise<void> {
    const user = await firstValueFrom(
      this.http.get<{ username: string | null; points: number; quizUnlocked: boolean; quizPopupShown: boolean; email: string; photoUrl: string | null; bio: string | null }>(`${environment.apiUrl}/users/me`)
    );
    this.username.set(user.username);
    this.points.set(user.points);
    this.quizUnlocked.set(user.quizUnlocked);
    this.quizPopupShown.set(user.quizPopupShown);
    this.photoUrl.set(user.photoUrl);
    this.bio.set(user.bio);
    this.email.set(user.email);
  }

  async dismissQuizPopup(): Promise<void> {
    this.quizPopupShown.set(true);
    await firstValueFrom(
      this.http.patch(`${environment.apiUrl}/users/me`, { quizPopupShown: true })
    );
  }

  async updateProfile(data: { email?: string; username?: string; bio?: string }): Promise<{ error?: string }> {
    try {
      const result = await firstValueFrom(
        this.http.patch<{ id: number; username: string | null; points: number; email: string; bio: string | null; photoUrl: string | null }>(
          `${environment.apiUrl}/users/me`, data
        )
      );
      this.username.set(result.username);
      this.email.set(result.email);
      this.bio.set(result.bio);
      this.photoUrl.set(result.photoUrl);
      return {};
    } catch (e: any) {
      return { error: e?.error?.error || 'unknown' };
    }
  }

  async uploadAvatar(file: File): Promise<string | null> {
    const formData = new FormData();
    formData.append('photo', file);
    const result = await firstValueFrom(
      this.http.post<{ photoUrl: string }>(`${environment.apiUrl}/users/me/photo`, formData)
    );
    this.photoUrl.set(result.photoUrl);
    return result.photoUrl;
  }

  logout(): void {
    Preferences.remove({ key: TOKEN_KEY });
    this.token.set(null);
    this.username.set(null);
    this.points.set(0);
    this.quizUnlocked.set(false);
    this.photoUrl.set(null);
    this.bio.set(null);
    this.email.set(null);
    this.injector.get(TrekService).clear();
    this.injector.get(CollectionService).clear();
    this.router.navigate(['/login']);
  }

  private setToken(token: string): void {
    Preferences.set({ key: TOKEN_KEY, value: token });
    this.token.set(token);
  }
}
