// AuthService: manages login/register, JWT storage, and current user state
// Like a combination of AuthenticationManager + SecurityContext in Spring
//
// Same patterns as CollectionService: inject(), signals, firstValueFrom()

import { inject, Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthResponse } from '../models/auth.model';
import { I18nService } from '../i18n';

// localStorage key where we store the JWT (like a cookie name)
const TOKEN_KEY = 'herbia-token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  // Signal holds the current JWT token (reactive, like CollectionService's signal)
  // Initialize from localStorage in case the user is already logged in (page refresh)
  private readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  // Computed signal: true if logged in
  // Like checking SecurityContextHolder.getContext().getAuthentication() != null
  // Any template reading isLoggedIn() will automatically update when token changes
  readonly isLoggedIn = computed(() => this.token() !== null);

  // In-memory only: true right after register, false otherwise
  readonly justRegistered = signal(false);

  // How many times the user has seen the mission tip (show until 4)
  readonly missionTipCount = signal(4); // default 4 = don't show

  // Used by the HTTP interceptor to add "Authorization: Bearer <token>" to requests
  getToken(): string | null {
    return this.token();
  }

  async checkEmail(email: string): Promise<{ exists: boolean; lang?: string }> {
    return firstValueFrom(
      this.http.post<{ exists: boolean; lang?: string }>(`${this.apiUrl}/check-email`, { email })
    );
  }

  async register(email: string, password: string, lang: string): Promise<void> {
    const result = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.apiUrl}/register`, { email, password, lang })
    );
    this.i18n.setLang(lang as 'es' | 'fr');
    this.justRegistered.set(true);
    this.missionTipCount.set(result.user.missionTipCount);
    this.setToken(result.token);
  }

  async login(email: string, password: string): Promise<void> {
    const result = await firstValueFrom(
      this.http.post<AuthResponse>(`${this.apiUrl}/login`, { email, password })
    );
    this.i18n.setLang(result.user.lang as 'es' | 'fr');
    this.missionTipCount.set(result.user.missionTipCount);
    this.setToken(result.token);
  }

  async dismissMissionTip(): Promise<void> {
    this.missionTipCount.update(c => c + 1);
    await firstValueFrom(
      this.http.patch(`${environment.apiUrl}/users/me`, { incrementMissionTip: true })
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.token.set(null);
    this.router.navigate(['/login']);
  }

  private setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
    this.token.set(token);
  }
}
