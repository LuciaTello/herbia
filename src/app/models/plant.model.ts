// Plant: what Gemini returns (a suggestion, no id yet)
export interface Plant {
  commonName: string;
  scientificName: string;
  description: string;
  imageUrl: string;
}

// FoundPlant: what PostgreSQL returns (a saved plant, with id and metadata)
// Flat structure that matches the database table directly (like a JPA entity)
export interface FoundPlant {
  id: number;
  commonName: string;
  scientificName: string;
  description: string;
  imageUrl: string;
  route: string;
  foundAt: string;
}
