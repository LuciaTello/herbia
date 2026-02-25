// ImageService: fetches plant photos from Wikipedia (primary) + iNaturalist (gallery)
// Both search by scientific name (Latin) — always returns the correct species
// Wikipedia: 1 high-quality curated photo per species (originalimage)
// iNaturalist: multiple research-grade photos at large resolution (1024px)

import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ImageService {

  private cache = new Map<string, string[]>();

  async getImages(commonName: string, scientificName: string): Promise<string[]> {
    const cached = this.cache.get(scientificName);
    if (cached) return cached;

    // Fetch Wikipedia hero image and iNaturalist gallery photos in parallel
    const [wikiUrl, iNatUrls] = await Promise.all([
      this.fetchFromWikipedia(scientificName),
      this.fetchFromINaturalist(scientificName),
    ]);

    // Wikipedia first (best quality), then iNaturalist (more angles)
    const urls: string[] = [];
    if (wikiUrl) urls.push(wikiUrl);
    for (const url of iNatUrls) {
      if (url !== wikiUrl) urls.push(url);
    }

    this.cache.set(scientificName, urls);
    return urls;
  }

  // Clean botanical notation that Wikipedia doesn't understand:
  // "Helleborus niger/orientalis" → "Helleborus niger"
  // "Taraxacum officinale agg." → "Taraxacum officinale"
  private cleanForWikipedia(name: string): string {
    return name
      .split('/')[0]              // take first part before slash
      .replace(/\s+(agg|s\.l|s\.s|var|subsp)\.?.*$/i, '')  // strip botanical suffixes
      .trim();
  }

  private async fetchFromWikipedia(scientificName: string): Promise<string> {
    try {
      const clean = this.cleanForWikipedia(scientificName);
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean)}`;
      const response = await fetch(url);
      if (!response.ok) return '';
      const data = await response.json();
      // Use originalimage (full res) instead of thumbnail (tiny ~320px)
      return data.originalimage?.source || '';
    } catch {
      return '';
    }
  }

  private async fetchFromINaturalist(scientificName: string): Promise<string[]> {
    try {
      const url = `https://api.inaturalist.org/v1/observations?taxon_name=${encodeURIComponent(scientificName)}&photos=true&per_page=5&quality_grade=research&order_by=votes`;
      const response = await fetch(url);
      if (!response.ok) return [];
      const data = await response.json();

      const urls: string[] = [];
      for (const obs of data.results || []) {
        const photo = obs.photos?.[0];
        if (photo?.url) {
          urls.push(photo.url.replace('square', 'large'));
        }
      }
      return urls;
    } catch {
      return [];
    }
  }

  // Enrich plants: always fetch fresh images (Wikipedia + iNaturalist)
  async enrichWithImages<T extends { commonName: string; scientificName: string; imageUrls?: string[] }>(plants: T[]): Promise<T[]> {
    return Promise.all(
      plants.map(async (plant) => {
        const imageUrls = await this.getImages(plant.commonName, plant.scientificName);
        if (imageUrls.length) return { ...plant, imageUrls };
        return plant;
      })
    );
  }
}
