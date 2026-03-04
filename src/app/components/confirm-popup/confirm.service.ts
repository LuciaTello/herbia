import { Injectable, signal } from '@angular/core';

interface PendingConfirm {
  message: string;
  destructive: boolean;
  confirmLabel?: string;
  resolve: (value: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly pending = signal<PendingConfirm | null>(null);

  confirm(message: string, destructive = true, confirmLabel?: string): Promise<boolean> {
    return new Promise<boolean>(resolve => {
      this.pending.set({ message, destructive, confirmLabel, resolve });
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
