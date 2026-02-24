// Plant: what Gemini returns (a suggestion, no id yet)
export interface Plant {
  commonName: string;
  scientificName: string;
  chancePercent: number;
  description: string;
  imageUrl: string;
}

// SuggestedPlant: a plant tied to a trek in PostgreSQL (with found state)
export interface SuggestedPlant {
  id: number;
  commonName: string;
  scientificName: string;
  chancePercent: number;
  description: string;
  imageUrl: string;
  found: boolean;
  foundAt: string | null;
  trekId: number;
  trek?: { origin: string; destination: string };
}

// Trek: a search (origin → destination) with its suggested plants
export interface Trek {
  id: number;
  origin: string;
  destination: string;
  createdAt: string;
  plants: SuggestedPlant[];
}
