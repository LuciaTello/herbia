// PlantPhoto: a photo fetched from Wikipedia or iNaturalist (stored in plant_photos table)
export interface PlantPhoto {
  id?: number;
  url: string;
  source: string;
}

// Plant: what Gemini returns (a suggestion, no id yet)
export interface Plant {
  commonName: string;
  scientificName: string;
  chancePercent: number;
  description: string;
  photos: PlantPhoto[];
}

// SuggestedPlant: a plant tied to a trek in PostgreSQL (with found state)
export interface SuggestedPlant {
  id: number;
  commonName: string;
  scientificName: string;
  chancePercent: number;
  description: string;
  photos: PlantPhoto[];
  found: boolean;
  foundAt: string | null;
  trekId: number;
  trek?: { origin: string; destination: string };
}

// SuggestResult: what POST /api/plants/suggest returns (description + plants)
export interface SuggestResult {
  description: string;
  plants: Plant[];
}

// Trek: a search (origin → destination) for a specific month
export interface Trek {
  id: number;
  origin: string;
  destination: string;
  description: string;
  month: number;
  year: number;
  createdAt: string;
  plants: SuggestedPlant[];
}
