import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CollectionService } from '../../services/collection.service';

@Component({
  selector: 'app-collection',
  imports: [RouterLink],
  templateUrl: './collection.html',
  styleUrl: './collection.css',
})
// OnInit is like @PostConstruct in Spring: runs after the component is created
export class CollectionPage implements OnInit {
  private readonly collectionService = inject(CollectionService);
  protected readonly collection = this.collectionService.getCollection();

  // ngOnInit runs when the component loads (like @PostConstruct)
  // We load the collection from the backend here
  async ngOnInit(): Promise<void> {
    await this.collectionService.loadCollection();
  }

  // Now uses id (from PostgreSQL) instead of scientificName
  async removePlant(id: number): Promise<void> {
    await this.collectionService.removePlant(id);
  }
}
