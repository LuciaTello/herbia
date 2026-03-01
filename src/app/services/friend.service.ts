import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FriendInfo {
  id: number;
  username: string | null;
  points: number;
}

export interface PendingRequest {
  friendshipId: number;
  id: number;
  username: string | null;
  points: number;
}

@Injectable({ providedIn: 'root' })
export class FriendService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/friends`;

  readonly friends = signal<FriendInfo[]>([]);
  readonly pending = signal<PendingRequest[]>([]);

  async loadFriends(): Promise<void> {
    const friends = await firstValueFrom(this.http.get<FriendInfo[]>(this.apiUrl));
    this.friends.set(friends);
  }

  async loadPending(): Promise<void> {
    const pending = await firstValueFrom(this.http.get<PendingRequest[]>(`${this.apiUrl}/pending`));
    this.pending.set(pending);
  }

  async searchUsers(q: string): Promise<FriendInfo[]> {
    return firstValueFrom(this.http.get<FriendInfo[]>(`${this.apiUrl}/search`, { params: { q } }));
  }

  async sendRequest(username: string): Promise<void> {
    await firstValueFrom(this.http.post(`${this.apiUrl}/request`, { username }));
  }

  async acceptRequest(friendshipId: number): Promise<void> {
    await firstValueFrom(this.http.patch(`${this.apiUrl}/${friendshipId}/accept`, {}));
    this.pending.update(list => list.filter(p => p.friendshipId !== friendshipId));
    await this.loadFriends();
  }

  async rejectRequest(friendshipId: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiUrl}/${friendshipId}`));
    this.pending.update(list => list.filter(p => p.friendshipId !== friendshipId));
  }

  async removeFriend(friendshipId: number): Promise<void> {
    await firstValueFrom(this.http.delete(`${this.apiUrl}/${friendshipId}`));
    await this.loadFriends();
  }
}
