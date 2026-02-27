import { Component, computed, input, output } from '@angular/core';
import { CONTINENTS } from '../../utils/continents';
import { Lang } from '../../i18n/translations';

@Component({
  selector: 'app-world-map',
  templateUrl: './world-map.html',
  styleUrl: './world-map.css',
})
export class WorldMapComponent {
  readonly plantCounts = input.required<Record<string, number>>();
  readonly lang = input.required<Lang>();
  readonly continentSelected = output<string>();

  protected readonly continents = computed(() => {
    const counts = this.plantCounts();
    const l = this.lang();
    return CONTINENTS.map(c => ({
      id: c.id,
      name: c[l],
      count: counts[c.id] || 0,
    }));
  });

  protected continent(id: string) {
    return this.continents().find(c => c.id === id)!;
  }

  protected fillColor(count: number): string {
    if (count === 0) return '#dfe6e9';
    if (count <= 3) return '#a8e6cf';
    if (count <= 10) return '#55c57a';
    return '#2d7d46';
  }

  protected onContinentClick(id: string): void {
    this.continentSelected.emit(id);
  }
}
