import { Component, EventEmitter, HostListener, inject, Output, signal } from '@angular/core';
import { I18nService } from '../../i18n';

interface Slide {
  emoji: string;
  imageIndex: number | null; // index into familyImages, or null for no image
}

@Component({
  selector: 'app-families-tutorial',
  templateUrl: './families-tutorial.html',
  styleUrl: './families-tutorial.css',
})
export class FamiliesTutorialComponent {
  @Output() done = new EventEmitter<void>();

  protected readonly i18n = inject(I18nService);
  protected readonly currentSlide = signal(0);

  protected readonly slides: Slide[] = [
    { emoji: '🌍', imageIndex: null },   // Intro: European families
    { emoji: '📝', imageIndex: null },   // Latin names & common names
    { emoji: '🌼', imageIndex: 0 },     // Asteraceae
    { emoji: '🦋', imageIndex: 1 },     // Fabaceae
    { emoji: '🌿', imageIndex: 2 },     // Lamiaceae
    { emoji: '✝️', imageIndex: 3 },     // Brassicaceae
    { emoji: '☂️', imageIndex: 4 },     // Apiaceae
    { emoji: '🌾', imageIndex: 5 },     // Poaceae & Rosaceae
    { emoji: '🔎', imageIndex: null },   // 3-question method
    { emoji: '🌸', imageIndex: null },   // 5 flower shapes cheat code
  ];

  protected readonly totalSlides = this.slides.length;

  // Representative photos for each family (verified Wikipedia API thumbnails)
  protected readonly familyImages = [
    // Asteraceae — Leucanthemum vulgare (ox-eye daisy)
    'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e7/Leucanthemum_vulgare_%27Filigran%27_Flower_2200px.jpg/250px-Leucanthemum_vulgare_%27Filigran%27_Flower_2200px.jpg',
    // Fabaceae — Trifolium pratense (red clover)
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Trifolium_pratense_-_Keila2.jpg/250px-Trifolium_pratense_-_Keila2.jpg',
    // Lamiaceae — Lavandula angustifolia (lavender)
    'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Single_lavender_flower02.jpg/250px-Single_lavender_flower02.jpg',
    // Brassicaceae — Brassica rapa
    'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d9/Brassica_rapa_plant.jpg/250px-Brassica_rapa_plant.jpg',
    // Apiaceae — Daucus carota (wild carrot)
    'https://upload.wikimedia.org/wikipedia/commons/thumb/2/23/Daucus_carota_May_2008-1_edit.jpg/250px-Daucus_carota_May_2008-1_edit.jpg',
    // Poaceae — Triticum (wheat)
    'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Vehn%C3%A4pelto_6.jpg/250px-Vehn%C3%A4pelto_6.jpg',
  ];

  protected readonly familyImageLabels = [
    'Leucanthemum vulgare',
    'Trifolium pratense',
    'Lavandula angustifolia',
    'Brassica rapa',
    'Daucus carota',
    'Triticum aestivum',
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
