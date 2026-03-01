import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FriendService, FriendInfo } from '../../services/friend.service';
import { I18nService } from '../../i18n';

const LEVEL_THRESHOLDS = [0, 10, 30, 60, 100, 200];
const LEVEL_EMOJIS = ['🌱', '🌿', '🪻', '🌺', '🌳', '👑'];

function getLevelEmoji(points: number): string {
  let idx = 0;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_THRESHOLDS[i]) { idx = i; break; }
  }
  return LEVEL_EMOJIS[idx];
}

@Component({
  selector: 'app-friends',
  imports: [RouterLink, FormsModule],
  templateUrl: './friends.html',
  styleUrl: './friends.css',
})
export class FriendsPage implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly friendService = inject(FriendService);
  protected readonly i18n = inject(I18nService);

  protected readonly searchQuery = signal('');
  protected readonly searchResults = signal<FriendInfo[]>([]);
  protected readonly usernameInput = signal('');
  protected readonly message = signal<string | null>(null);
  protected readonly loading = signal(true);

  protected levelEmoji = getLevelEmoji;

  async ngOnInit(): Promise<void> {
    await this.auth.refreshProfile();
    await Promise.all([
      this.friendService.loadFriends(),
      this.friendService.loadPending(),
    ]);
    this.loading.set(false);
  }

  async saveUsername(): Promise<void> {
    const name = this.usernameInput().trim();
    if (!name) return;
    try {
      await this.auth.updateUsername(name);
    } catch (e: any) {
      this.message.set(e?.error?.error || 'Error');
      setTimeout(() => this.message.set(null), 3000);
    }
  }

  async onSearch(): Promise<void> {
    const q = this.searchQuery().trim();
    if (q.length < 2) { this.searchResults.set([]); return; }
    const results = await this.friendService.searchUsers(q);
    this.searchResults.set(results);
  }

  async sendRequest(username: string): Promise<void> {
    try {
      await this.friendService.sendRequest(username);
      this.message.set(this.i18n.t().friends.requestSent);
      this.searchResults.set([]);
      this.searchQuery.set('');
    } catch (e: any) {
      this.message.set(e?.error?.error || 'Error');
    }
    setTimeout(() => this.message.set(null), 3000);
  }

  async accept(friendshipId: number): Promise<void> {
    await this.friendService.acceptRequest(friendshipId);
  }

  async reject(friendshipId: number): Promise<void> {
    await this.friendService.rejectRequest(friendshipId);
  }
}
