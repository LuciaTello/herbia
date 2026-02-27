import { Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';

@Component({
  selector: 'app-photo-gallery',
  templateUrl: './photo-gallery.html',
  styleUrl: './photo-gallery.css',
})
export class PhotoGalleryComponent {
  @Input({ required: true }) images!: string[];
  @Input({ required: true }) plantName!: string;
  @Input() startIndex = 0;
  @Output() closeGallery = new EventEmitter<void>();

  protected readonly currentIndex = signal(0);
  protected readonly imageLoading = signal(true);
  private touchStartX = 0;

  ngOnInit(): void {
    this.currentIndex.set(this.startIndex);
    this.preloadAll();
  }

  private preloadAll(): void {
    for (const src of this.images) {
      const img = new Image();
      img.src = src;
    }
  }

  protected onImageLoad(): void {
    this.imageLoading.set(false);
  }

  protected prev(): void {
    this.imageLoading.set(true);
    this.currentIndex.update(i => (i > 0 ? i - 1 : this.images.length - 1));
  }

  protected next(): void {
    this.imageLoading.set(true);
    this.currentIndex.update(i => (i < this.images.length - 1 ? i + 1 : 0));
  }

  protected close(): void {
    this.closeGallery.emit();
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
    if (e.key === 'Escape') this.close();
    if (e.key === 'ArrowLeft') this.prev();
    if (e.key === 'ArrowRight') this.next();
  }
}
