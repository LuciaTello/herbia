// PlantNet identification service
// Sends a photo to PlantNet API and compares with expected scientific name

const PLANTNET_URL = 'https://my-api.plantnet.org/v2/identify/all';

interface PlantNetSpecies {
  scientificNameWithoutAuthor: string;
  genus: { scientificNameWithoutAuthor: string };
  family: { scientificNameWithoutAuthor: string };
  commonNames: string[];
}

interface PlantNetResult {
  score: number;
  species: PlantNetSpecies;
}

interface PlantNetResponse {
  results: PlantNetResult[];
}

export interface IdentifyResult {
  match: boolean;
  score: number;
  identifiedAs: string;
  commonName: string;
  similarity: number;
  genus: string;
  family: string;
}

/**
 * Normalize a scientific name for comparison:
 * lowercase, trim, take only genus + species (first 2 words)
 */
export function normalize(name: string): string {
  return name.trim().toLowerCase().split(/\s+/).slice(0, 2).join(' ');
}

/**
 * Lookup family for a scientific name via iNaturalist taxa API.
 * Returns the family name or '' if not found.
 */
async function lookupFamily(scientificName: string): Promise<string> {
  try {
    const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(scientificName)}&rank=species&per_page=1`;
    const response = await fetch(url, { headers: { 'User-Agent': 'herbia-app' } });
    if (!response.ok) return '';
    const data = await response.json();
    const taxon = data.results?.[0];
    if (!taxon) return '';
    const familyAncestor = (taxon.ancestors || []).find((a: any) => a.rank === 'family');
    return familyAncestor?.name || '';
  } catch {
    return '';
  }
}

/**
 * Lookup synonyms for a scientific name via iNaturalist taxa API.
 * Returns a Set of normalized synonyms (including the canonical name).
 */
export async function lookupSynonyms(scientificName: string): Promise<Set<string>> {
  const synonyms = new Set<string>([normalize(scientificName)]);
  try {
    const url = `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(scientificName)}&rank=species&per_page=1&all_names=true`;
    const response = await fetch(url, { headers: { 'User-Agent': 'herbia-app' } });
    if (!response.ok) return synonyms;
    const data = await response.json();
    const taxon = data.results?.[0];
    if (!taxon) return synonyms;
    // Add the canonical iNaturalist name
    if (taxon.name) synonyms.add(normalize(taxon.name));
    // Add all scientific name synonyms (lexicon is "scientific-names" with kebab-case)
    for (const n of taxon.names || []) {
      if (n.lexicon === 'scientific-names') {
        synonyms.add(normalize(n.name));
      }
    }
  } catch {
    // ignore — return what we have
  }
  return synonyms;
}

/**
 * Call PlantNet API and return raw results (for reuse by identify-all).
 */
export async function callPlantNet(
  buffer: Buffer,
  mimetype: string,
): Promise<PlantNetResult[]> {
  const apiKey = process.env['PLANTNET_API_KEY'];
  if (!apiKey) {
    throw new Error('PLANTNET_API_KEY not configured');
  }

  const ext = mimetype === 'image/png' ? 'png' : 'jpg';
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const file = new File([arrayBuffer], `photo.${ext}`, { type: mimetype });
  const formData = new FormData();
  formData.append('images', file);
  formData.append('organs', 'auto');

  const response = await fetch(`${PLANTNET_URL}?api-key=${apiKey}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 404) return []; // not a plant
    const text = await response.text();
    throw new Error(`PlantNet API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as PlantNetResponse;
  return data.results || [];
}

/**
 * Calculate taxonomic similarity between ALL PlantNet results and an expected species.
 * Iterates all results for exact/synonym matches (like identifyPlant does),
 * then falls back to genus/family from the best result.
 */
export async function calculateSimilarity(
  allResults: PlantNetResult[],
  expectedScientificName: string,
  expectedGenus: string,
  expectedFamily: string,
): Promise<{ similarity: number; genus: string; family: string }> {
  if (!allResults.length) return { similarity: 0, genus: '', family: '' };

  const expected = normalize(expectedScientificName);
  const best = allResults[0];
  const bestGenus = best.species.genus?.scientificNameWithoutAuthor || '';
  const bestFamily = best.species.family?.scientificNameWithoutAuthor || '';

  // Derive genus from scientific name if missing
  if (!expectedGenus && expectedScientificName) {
    expectedGenus = expectedScientificName.trim().split(/\s+/)[0];
  }

  // Check ALL results for exact species match
  for (const result of allResults) {
    if (normalize(result.species.scientificNameWithoutAuthor) === expected) {
      const g = result.species.genus?.scientificNameWithoutAuthor || '';
      const f = result.species.family?.scientificNameWithoutAuthor || '';
      return { similarity: 100, genus: g, family: f };
    }
  }

  // Check ALL results for synonym match
  const synonyms = await lookupSynonyms(expectedScientificName);
  if (synonyms.size > 1) {
    for (const result of allResults) {
      const candidate = normalize(result.species.scientificNameWithoutAuthor);
      if (synonyms.has(candidate)) {
        const g = result.species.genus?.scientificNameWithoutAuthor || '';
        const f = result.species.family?.scientificNameWithoutAuthor || '';
        return { similarity: 100, genus: g, family: f };
      }
    }
  }

  // Genus match (from best result, including synonym genera)
  const expectedGenera = new Set([expectedGenus.toLowerCase()]);
  for (const syn of synonyms) {
    const g = syn.split(' ')[0];
    if (g) expectedGenera.add(g);
  }

  if (bestGenus && expectedGenera.has(bestGenus.toLowerCase())) {
    return { similarity: 75, genus: bestGenus, family: bestFamily };
  }

  // Family match
  if (!expectedFamily && expectedScientificName) {
    expectedFamily = await lookupFamily(expectedScientificName);
  }
  if (expectedFamily && bestFamily && bestFamily.toLowerCase() === expectedFamily.toLowerCase()) {
    return { similarity: 40, genus: bestGenus, family: bestFamily };
  }

  return { similarity: 0, genus: bestGenus, family: bestFamily };
}

export async function identifyPlant(
  buffer: Buffer,
  mimetype: string,
  expectedScientificName: string,
  expectedGenus: string = '',
  expectedFamily: string = '',
): Promise<IdentifyResult> {
  const apiKey = process.env['PLANTNET_API_KEY'];
  if (!apiKey) {
    throw new Error('PLANTNET_API_KEY not configured');
  }

  const ext = mimetype === 'image/png' ? 'png' : 'jpg';
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
  const file = new File([arrayBuffer], `photo.${ext}`, { type: mimetype });
  const formData = new FormData();
  formData.append('images', file);
  formData.append('organs', 'auto');

  const response = await fetch(`${PLANTNET_URL}?api-key=${apiKey}`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    // 404 = PlantNet couldn't identify anything in the image (e.g. not a plant)
    if (response.status === 404) {
      return { match: false, score: 0, identifiedAs: '', commonName: '', similarity: 0, genus: '', family: '' };
    }
    const text = await response.text();
    throw new Error(`PlantNet API error ${response.status}: ${text}`);
  }

  const data = (await response.json()) as PlantNetResponse;

  if (!data.results?.length) {
    return { match: false, score: 0, identifiedAs: '', commonName: '', similarity: 0, genus: '', family: '' };
  }

  const expected = normalize(expectedScientificName);

  // Derive genus from scientific name if missing (first word of binomial)
  if (!expectedGenus && expectedScientificName) {
    expectedGenus = expectedScientificName.trim().split(/\s+/)[0];
  }

  // Check ALL results for an exact genus+species match (not just top 3,
  // because PlantNet may rank the correct species lower)
  for (const result of data.results) {
    const candidate = normalize(result.species.scientificNameWithoutAuthor);
    if (candidate === expected) {
      return {
        match: true,
        score: Math.round(result.score * 100),
        identifiedAs: result.species.scientificNameWithoutAuthor,
        commonName: result.species.commonNames?.[0] || '',
        similarity: 100,
        genus: result.species.genus?.scientificNameWithoutAuthor || '',
        family: result.species.family?.scientificNameWithoutAuthor || '',
      };
    }
  }

  // No direct match — check synonyms (e.g. Ficaria verna ↔ Ranunculus ficaria)
  const synonyms = await lookupSynonyms(expectedScientificName);
  if (synonyms.size > 1) {
    for (const result of data.results) {
      const candidate = normalize(result.species.scientificNameWithoutAuthor);
      if (synonyms.has(candidate)) {
        return {
          match: true,
          score: Math.round(result.score * 100),
          identifiedAs: result.species.scientificNameWithoutAuthor,
          commonName: result.species.commonNames?.[0] || '',
          similarity: 100,
          genus: result.species.genus?.scientificNameWithoutAuthor || '',
          family: result.species.family?.scientificNameWithoutAuthor || '',
        };
      }
    }
  }

  // No match — compute taxonomic similarity from best result
  const best = data.results[0];
  const bestGenus = best.species.genus?.scientificNameWithoutAuthor || '';
  const bestFamily = best.species.family?.scientificNameWithoutAuthor || '';

  let similarity = 0;
  // Check genus across all synonyms too (e.g. expectedGenus "Ficaria",
  // but PlantNet says genus "Ranunculus" which is a synonym genus)
  const expectedGenera = new Set([expectedGenus.toLowerCase()]);
  for (const syn of synonyms) {
    const g = syn.split(' ')[0];
    if (g) expectedGenera.add(g);
  }

  if (bestGenus && expectedGenera.has(bestGenus.toLowerCase())) {
    similarity = 75;
  } else {
    // Lookup family from iNaturalist if missing
    if (!expectedFamily && expectedScientificName) {
      expectedFamily = await lookupFamily(expectedScientificName);
    }
    if (expectedFamily && bestFamily && bestFamily.toLowerCase() === expectedFamily.toLowerCase()) {
      similarity = 40;
    }
  }

  return {
    match: false,
    score: Math.round(best.score * 100),
    identifiedAs: best.species.scientificNameWithoutAuthor,
    commonName: best.species.commonNames?.[0] || '',
    similarity,
    genus: bestGenus,
    family: bestFamily,
  };
}
