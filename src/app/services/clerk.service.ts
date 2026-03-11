// ClerkService: singleton that owns the Clerk JS instance.
// Initialized via APP_INITIALIZER before routing starts.

import { Injectable, signal } from '@angular/core';
import { Clerk } from '@clerk/clerk-js';
import { environment } from '../../environments/environment';

type ClerkInstance = InstanceType<typeof Clerk>;

@Injectable({ providedIn: 'root' })
export class ClerkService {
  clerk!: ClerkInstance;

  // Mirrors clerk.user — updated after load, signIn, signOut so Angular signals stay reactive
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly user = signal<any>(null);

  async init(): Promise<void> {
    this.clerk = new Clerk(environment.clerkPublishableKey);
    await this.clerk.load();
    this.user.set(this.clerk.user ?? null);
  }

  async getToken(): Promise<string | null> {
    return this.clerk.session?.getToken() ?? null;
  }
}
