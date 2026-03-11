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

  // Which field is currently being edited
  protected readonly editing = signal<'username' | 'bio' | null>(null);

  // Temporary values while editing
  protected draftUsername = '';
  protected draftBio = '';

  protected saving = signal(false);
  protected error = signal<string | null>(null);
  protected uploading = signal(false);

  protected startEdit(field: 'username' | 'bio'): void {
    this.error.set(null);
    if (field === 'username') this.draftUsername = this.auth.username() ?? '';
    if (field === 'bio') this.draftBio = this.auth.bio() ?? '';
    this.editing.set(field);
  }

  protected cancelEdit(): void {
    this.editing.set(null);
    this.error.set(null);
  }

  protected async saveField(field: 'username' | 'bio'): Promise<void> {
    this.saving.set(true);
    this.error.set(null);

    const data = field === 'username'
      ? { username: this.draftUsername }
      : { bio: this.draftBio };

    const result = await this.auth.updateProfile(data);

    this.saving.set(false);

    if (result.error) {
      this.error.set(
        result.error === 'username_taken'
          ? this.i18n.t().profile.usernameTaken
          : result.error
      );
    } else {
      this.editing.set(null);
    }
  }

  protected async onPhotoChange(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploading.set(true);
    this.error.set(null);
    try {
      await this.auth.uploadAvatar(file);
    } catch (e: any) {
      this.error.set(e?.message || 'Photo upload failed');
    }
    this.uploading.set(false);
    input.value = '';
  }
}
