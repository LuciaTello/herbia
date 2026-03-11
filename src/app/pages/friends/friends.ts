import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FriendService, FriendInfo, FriendProfile } from '../../services/friend.service';
import { I18nService } from '../../i18n';
import { ConfirmService } from '../../components/confirm-popup/confirm.service';
import { ConfirmPopupComponent } from '../../components/confirm-popup/confirm-popup';

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
  imports: [RouterLink, FormsModule, ConfirmPopupComponent],
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
  protected readonly confirmService = inject(ConfirmService);
  protected readonly selectedFriend = signal<(FriendProfile & { friendshipId: number }) | null>(null);

  protected readonly friendLevel = computed(() => {
    const f = this.selectedFriend();
    if (!f) return null;
    let idx = 0;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (f.points >= LEVEL_THRESHOLDS[i]) { idx = i; break; }
    }
    const isMax = idx >= LEVEL_THRESHOLDS.length - 1;
    const progress = isMax ? 100 : Math.round(((f.points - LEVEL_THRESHOLDS[idx]) / (LEVEL_THRESHOLDS[idx + 1] - LEVEL_THRESHOLDS[idx])) * 100);
    return { emoji: LEVEL_EMOJIS[idx], name: this.i18n.t().level.levels[idx].name, progress };
  });

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
    const ok = await this.confirmService.confirm(this.i18n.t().confirm.acceptFriend, false, this.i18n.t().friends.accept);
    if (!ok) return;
    await this.friendService.acceptRequest(friendshipId);
  }

  async reject(friendshipId: number): Promise<void> {
    const ok = await this.confirmService.confirm(this.i18n.t().confirm.rejectFriend);
    if (!ok) return;
    await this.friendService.rejectRequest(friendshipId);
  }

  async openFriend(friend: FriendInfo): Promise<void> {
    const profile = await this.friendService.getProfile(friend.id);
    this.selectedFriend.set({ ...profile, friendshipId: friend.friendshipId! });
  }

  closeFriend(): void {
    this.selectedFriend.set(null);
  }

  async removeFriend(): Promise<void> {
    const friend = this.selectedFriend();
    if (!friend) return;
    const ok = await this.confirmService.confirm(this.i18n.t().confirm.removeFriend);
    if (!ok) return;
    await this.friendService.removeFriend(friend.friendshipId);
    this.closeFriend();
  }
}
