import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { I18nService } from '../../i18n';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile',
  imports: [RouterLink, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class ProfilePage {
  protected readonly i18n = inject(I18nService);
  protected readonly auth = inject(AuthService);

  protected username = '';
  protected email = '';
  protected bio = '';
  protected saving = signal(false);
  protected saved = signal(false);
  protected error = signal<string | null>(null);
  protected uploading = signal(false);

  constructor() {
    this.username = this.auth.username() ?? '';
    this.email = this.auth.email() ?? '';
    this.bio = this.auth.bio() ?? '';
  }

  protected async onSave(): Promise<void> {
    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);

    const result = await this.auth.updateProfile({
      username: this.username,
      email: this.email,
      bio: this.bio,
    });

    this.saving.set(false);

    if (result.error) {
      if (result.error === 'email_taken') {
        this.error.set(this.i18n.t().profile.emailTaken);
      } else if (result.error === 'username_taken') {
        this.error.set(this.i18n.t().profile.usernameTaken);
      } else {
        this.error.set(result.error);
      }
    } else {
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 2000);
    }
  }

  protected async onPhotoChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.uploading.set(true);
    try {
      await this.auth.uploadAvatar(file);
    } catch {
      // silently fail
    }
    this.uploading.set(false);
    input.value = '';
  }
}
