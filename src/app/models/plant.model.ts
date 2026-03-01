// PlantPhoto: a photo fetched from Wikipedia or iNaturalist (stored in plant_photos table)
export interface PlantPhoto {
  id?: number;
  url: string;
  source: string;
}

// Plant: what the LLM returns (a suggestion, no id yet)
export interface Plant {
  commonName: string;
  scientificName: string;
  rarity: string;
  description: string;
  hint: string;
  genus?: string;
  family?: string;
  photos: PlantPhoto[];
}

// SuggestedPlant: a plant tied to a mission in PostgreSQL (with found state)
export interface SuggestedPlant {
  id: number;
  commonName: string;
  scientificName: string;
  rarity: string;
  description: string;
  hint: string;
  genus?: string;
  family?: string;
  source?: string;  // "ai" | "user"
  photos: PlantPhoto[];
  found: boolean;
  foundAt: string | null;
  foundInMissionId?: number | null;
  foundInMission?: { origin: string; destination: string } | null;
  missionId: number;
  mission?: { origin: string; destination: string; country?: string | null; countryCode?: string | null; region?: string | null; regionCode?: string | null };
}

// SuggestResult: what POST /api/plants/suggest returns (description + plants)
export interface SuggestResult {
  tooFar: boolean;
  description: string;
  plants: Plant[];
}

// IdentifyResult: what POST /api/missions/plants/:plantId/identify returns
export interface IdentifyResult {
  match: boolean;
  score: number;
  identifiedAs: string;
  commonName: string;
  similarity: number;
  genus: string;
  family: string;
}

// PlaceSelection: emitted by PlaceAutocomplete when a place is selected
export interface PlaceSelection {
  name: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionCode?: string;
  lat?: number;
  lng?: number;
}

// Mission: a search (origin → destination) for a specific month
export interface Mission {
  id: number;
  origin: string;
  destination: string;
  description: string;
  month: number;
  year: number;
  country?: string | null;
  countryCode?: string | null;
  region?: string | null;
  regionCode?: string | null;
  createdAt: string;
  status?: string;
  plants: SuggestedPlant[];
}
