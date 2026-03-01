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
function normalize(name: string): string {
  return name.trim().toLowerCase().split(/\s+/).slice(0, 2).join(' ');
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

  // Check top 3 results for a genus+species match
  const top3 = data.results.slice(0, 3);
  for (const result of top3) {
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

  // No match — compute taxonomic similarity from best result
  const best = data.results[0];
  const bestGenus = best.species.genus?.scientificNameWithoutAuthor || '';
  const bestFamily = best.species.family?.scientificNameWithoutAuthor || '';

  let similarity = 0;
  if (expectedGenus && bestGenus && bestGenus.toLowerCase() === expectedGenus.toLowerCase()) {
    similarity = 75;
  } else if (expectedFamily && bestFamily && bestFamily.toLowerCase() === expectedFamily.toLowerCase()) {
    similarity = 40;
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
