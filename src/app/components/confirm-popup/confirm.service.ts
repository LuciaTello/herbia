import { Injectable, signal } from '@angular/core';

interface PendingConfirm {
  message: string;
  resolve: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly pending = signal<PendingConfirm | null>(null);

  confirm(message: string): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this.pending.set({ message, resolve });
    });
  }

  accept(): void {
    this.pending()?.resolve(true);
    this.pending.set(null);
  }

  cancel(): void {
    this.pending()?.resolve(false);
    this.pending.set(null);
  }
}
