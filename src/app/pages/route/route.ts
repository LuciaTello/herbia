import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Plant } from '../../models/plant.model';
import { PlantService } from '../../services/plant.service';
import { CollectionService } from '../../services/collection.service';

@Component({
  selector: 'app-route',
  imports: [FormsModule, RouterLink],
  templateUrl: './route.html',
  styleUrl: './route.css',
})
export class RoutePage implements OnInit {
  // inject() is like @Autowired in Spring: Angular provides the singleton instance
  private readonly plantService = inject(PlantService);
  private readonly collectionService = inject(CollectionService);

  protected readonly origin = signal('');
  protected readonly destination = signal('');
  protected readonly plants = signal<Plant[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  // Load collection from backend so isInCollection() works
  async ngOnInit(): Promise<void> {
    await this.collectionService.loadCollection();
  }

  // async because we now await the backend response
  async onSearch(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const results = await this.plantService.getSuggestedPlants(
        this.origin(),
        this.destination(),
      );
      this.plants.set(results);
    } catch (e) {
      this.error.set('Error al buscar plantas. Verifica que el servidor esta arrancado.');
    } finally {
      this.loading.set(false);
    }
  }

  // Now async because addPlant calls the backend API
  async onPlantFound(plant: Plant): Promise<void> {
    const route = `${this.origin()} → ${this.destination()}`;
    await this.collectionService.addPlant(plant, route);
  }

  isInCollection(plant: Plant): boolean {
    return this.collectionService.isInCollection(plant);
  }
}
