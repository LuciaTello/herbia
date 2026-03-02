import { Component, EventEmitter, HostListener, inject, Output, signal } from '@angular/core';
import { I18nService } from '../../i18n';

interface Slide {
  emoji: string;
  imageIndices: number[];
}

@Component({
  selector: 'app-mission-tutorial',
  templateUrl: './mission-tutorial.html',
  styleUrl: './mission-tutorial.css',
})
export class MissionTutorialComponent {
  @Output() done = new EventEmitter<void>();

  protected readonly i18n = inject(I18nService);
  protected readonly currentSlide = signal(0);

  protected readonly slides: Slide[] = [
    { emoji: '🌿', imageIndices: [] },
    { emoji: '📸', imageIndices: [] },
    { emoji: '🎯', imageIndices: [0] },
    { emoji: '🌿', imageIndices: [0, 1] },
    { emoji: '🌳', imageIndices: [0, 2] },
    { emoji: '🌼', imageIndices: [] },
  ];

  protected readonly totalSlides = this.slides.length;

  protected readonly plantImages = [
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Single_lavender_flower02.jpg/160px-Single_lavender_flower02.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Lavandula_stoechas_1.jpg/160px-Lavandula_stoechas_1.jpg',
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/Mentha_spicata_Spearmint_%E0%B4%AA%E0%B5%81%E0%B4%A4%E0%B4%BF%E0%B4%A8.jpg/160px-Mentha_spicata_Spearmint_%E0%B4%AA%E0%B5%81%E0%B4%A4%E0%B4%BF%E0%B4%A8.jpg',
  ];

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
