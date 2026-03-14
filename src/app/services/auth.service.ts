// AuthService: manages current user state and profile sync with our backend.
// Clerk handles all session/token management; this service owns the user signals.

import { inject, Injectable, Injector, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { I18nService } from '../i18n';
import { TrekService } from './trek.service';
import { CollectionService } from './collection.service';
import { FriendService } from './friend.service';
import { ClerkService } from './clerk.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly injector = inject(Injector);
  private readonly clerkService = inject(ClerkService);
  private readonly apiUrl = `${environment.apiUrl}/auth`;

  // In-memory only: true right after register, false otherwise
  readonly justRegistered = signal(false);
  // True once the user profile has been fetched from the backend at least once
  readonly profileLoaded = signal(false);

  readonly trekTipCount = signal(4); // default 4 = don't show
  readonly username = signal<string | null>(null);
  readonly points = signal(0);
  readonly quizUnlocked = signal(false);
  readonly photoUrl = signal<string | null>(null);
  readonly bio = signal<string | null>(null);
  readonly email = signal<string | null>(null);
  readonly quizPopupShown = signal(false);

  // Derived from Clerk's user signal — reactive to sign-in/sign-out
  readonly isLoggedIn = computed(() => !!this.clerkService.user());

  // Called by APP_INITIALIZER after Clerk is loaded
  async init(): Promise<void> {
    if (this.clerkService.clerk.user) {
      await this.refreshProfile();
      this.injector.get(FriendService).loadPending().catch(() => {});
    }
  }

  async checkEmail(email: string): Promise<{ exists: boolean; lang?: string }> {
    return firstValueFrom(
      this.http.post<{ exists: boolean; lang?: string }>(`${this.apiUrl}/check-email`, { email })
    );
  }

  // Called after Clerk sign-up + email verification — creates user row in our DB
  async syncAfterRegister(lang: string, username?: string): Promise<void> {
    const result = await firstValueFrom(
      this.http.post<{ user: UserProfile }>(`${this.apiUrl}/sync`, { lang, username: username || undefined })
    );
    this.i18n.setLang(lang as 'es' | 'fr');
    this.justRegistered.set(true);
    this.applyProfile(result.user);
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
      this.http.get<UserProfile>(`${environment.apiUrl}/users/me`)
    );
    this.applyProfile(user);
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
    const compressed = await compressImage(file, 512, 0.82);
    const formData = new FormData();
    formData.append('photo', compressed, 'avatar.jpg');
    try {
      const result = await firstValueFrom(
        this.http.post<{ photoUrl: string }>(`${environment.apiUrl}/users/me/photo`, formData)
      );
      this.photoUrl.set(result.photoUrl);
      return result.photoUrl;
    } catch (e: any) {
      const msg = e?.error?.error || e?.message || 'Upload failed';
      throw new Error(msg);
    }
  }

  async logout(): Promise<void> {
    await this.clerkService.clerk.signOut();
    this.clerkService.user.set(null);
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

  private applyProfile(user: UserProfile): void {
    this.trekTipCount.set(user.trekTipCount);
    this.username.set(user.username);
    this.points.set(user.points);
    this.quizUnlocked.set(user.quizUnlocked);
    this.quizPopupShown.set(user.quizPopupShown ?? false);
    this.photoUrl.set(user.photoUrl);
    this.bio.set(user.bio);
    this.email.set(user.email);
    this.profileLoaded.set(true);
  }
}

interface UserProfile {
  username: string | null;
  points: number;
  quizUnlocked: boolean;
  quizPopupShown?: boolean;
  email: string;
  photoUrl: string | null;
  bio: string | null;
  trekTipCount: number;
}

// Resize + compress an image to JPEG using Canvas (stays well under Cloudinary's 10 MB limit)
function compressImage(file: File, maxSize: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}
