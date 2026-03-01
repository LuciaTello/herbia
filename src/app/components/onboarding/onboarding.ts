import { Component, EventEmitter, HostListener, inject, Output, signal } from '@angular/core';
import { I18nService } from '../../i18n';

@Component({
  selector: 'app-onboarding',
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.css',
})
export class OnboardingComponent {
  @Output() done = new EventEmitter<void>();

  protected readonly i18n = inject(I18nService);
  protected readonly currentSlide = signal(0);
  protected readonly emojis = ['🌿', '🗺️', '📸', '🏆', '⚠️'];
  protected readonly totalSlides = 5;

  private touchStartX = 0;

  protected next(): void {
    if (this.currentSlide() < this.totalSlides - 1) {
      this.currentSlide.update(i => i + 1);
    } else {
      this.done.emit();
    }
  }

  protected prev(): void {
    if (this.currentSlide() > 0) {
      this.currentSlide.update(i => i - 1);
    }
  }

  protected goTo(index: number): void {
    this.currentSlide.set(index);
  }

  protected onTouchStart(e: TouchEvent): void {
    this.touchStartX = e.touches[0].clientX;
  }

  protected onTouchEnd(e: TouchEvent): void {
    const delta = e.changedTouches[0].clientX - this.touchStartX;
    if (Math.abs(delta) > 50) {
      delta < 0 ? this.next() : this.prev();
    }
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'ArrowLeft') this.prev();
    if (e.key === 'ArrowRight') this.next();
  }
}
