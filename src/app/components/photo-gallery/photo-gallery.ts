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

  ngOnInit(): void {
    this.currentIndex.set(this.startIndex);
  }

  protected prev(): void {
    this.currentIndex.update(i => (i > 0 ? i - 1 : this.images.length - 1));
  }

  protected next(): void {
    this.currentIndex.update(i => (i < this.images.length - 1 ? i + 1 : 0));
  }

  protected close(): void {
    this.closeGallery.emit();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') this.close();
    if (e.key === 'ArrowLeft') this.prev();
    if (e.key === 'ArrowRight') this.next();
  }
}
