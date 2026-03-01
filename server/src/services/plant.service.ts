// PlantService: like a @Service class in Spring
// Contains the business logic for plant suggestions (iNaturalist real data + Groq/Llama AI descriptions + Wikipedia/iNaturalist images)

import Groq from 'groq-sdk';

// Groq client - initialized later by initPlantService() after dotenv has loaded
let groq: Groq;

// --- Private functions (not exported = private, like private methods in Java) ---

const LANG_NAMES: Record<string, string> = {
  es: 'Spanish',
  fr: 'French',
};

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface PlantPhoto {
  url: string;
  source: string; // "wikipedia" | "inaturalist"
}

// Hardcoded tooFar messages per language (same text as i18n strings)
const TOO_FAR: Record<string, string> = {
  es: 'Esa ruta cruza múltiples climas — prueba con un mission más corto para que las sugerencias de plantas sean más precisas.',
  fr: 'Cet itinéraire traverse plusieurs climats — essayez un mission plus court pour que les suggestions de plantes soient plus précises.',
};

// --- iNaturalist species discovery ---

interface INatSpecies {
  scientificName: string;
  commonName: string;
  count: number;
  photoUrl: string;
  taxonId: number;
  genus: string;
  family: string;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const toRad = (deg: number) => deg * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function fetchSpeciesCounts(
  lat: number, lng: number, radiusKm: number, month: number, locale: string,
): Promise<INatSpecies[]> {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
    radius: String(radiusKm),
    iconic_taxa: 'Plantae',
    month: String(month),
    quality_grade: 'research',
    per_page: '50',
    locale,
  });
  const url = `https://api.inaturalist.org/v1/observations/species_counts?${params}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'herbia-app' },
  });
  if (!response.ok) {
    console.warn(`iNaturalist species_counts returned ${response.status}`);
    return [];
  }
  const data = await response.json();
  const species: INatSpecies[] = [];
  for (const result of data.results || []) {
    const taxon = result.taxon;
    if (!taxon || taxon.rank !== 'species') continue;
    species.push({
      scientificName: taxon.name,
      commonName: taxon.preferred_common_name || taxon.name,
      count: result.count,
      photoUrl: taxon.default_photo?.medium_url || '',
      taxonId: taxon.id,
      genus: taxon.name.split(' ')[0],
      family: '',
    });
  }
  return species;
}

async function enrichWithTaxonomy(species: INatSpecies[]): Promise<void> {
  const ids = species.map(s => s.taxonId).join(',');
  if (!ids) return;
  try {
    const url = `https://api.inaturalist.org/v1/taxa/${ids}`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'herbia-app' },
    });
    if (!response.ok) return;
    const data = await response.json();
    const familyMap = new Map<number, string>();
    for (const taxon of data.results || []) {
      const familyAncestor = (taxon.ancestors || []).find((a: any) => a.rank === 'family');
      if (familyAncestor) {
        familyMap.set(taxon.id, familyAncestor.name);
      }
    }
    for (const s of species) {
      s.family = familyMap.get(s.taxonId) || '';
    }
  } catch (e) {
    console.warn('Failed to enrich taxonomy:', e);
  }
}

function assignRarity(count: number, maxCount: number): 'common' | 'rare' | 'veryRare' {
  const ratio = count / maxCount;
  if (ratio > 0.3) return 'common';
  if (ratio > 0.05) return 'rare';
  return 'veryRare';
}

function selectPlants(species: INatSpecies[], exclude: string[]): (INatSpecies & { rarity: string; genus: string; family: string })[] {
  const excludeLower = new Set(exclude.map(n => n.toLowerCase()));
  const filtered = species.filter(s => !excludeLower.has(s.scientificName.toLowerCase()));
  if (filtered.length === 0) return [];

  const maxCount = Math.max(...filtered.map(s => s.count));
  const withRarity = filtered.map(s => ({ ...s, rarity: assignRarity(s.count, maxCount) }));

  const common = withRarity.filter(s => s.rarity === 'common');
  const rare = withRarity.filter(s => s.rarity === 'rare');
  const veryRare = withRarity.filter(s => s.rarity === 'veryRare');

  const picked: (INatSpecies & { rarity: string })[] = [];
  picked.push(...common.slice(0, 3));
  picked.push(...rare.slice(0, 1));
  picked.push(...veryRare.slice(0, 1));

  // If we didn't get 5, fill from remaining
  if (picked.length < 5) {
    const pickedNames = new Set(picked.map(p => p.scientificName));
    for (const s of withRarity) {
      if (picked.length >= 5) break;
      if (!pickedNames.has(s.scientificName)) picked.push(s);
    }
  }

  return picked.slice(0, 5);
}

// --- LLM prompts ---

// Description-only prompt: the LLM adds fun descriptions to real iNaturalist plants
function buildDescriptionPrompt(
  plants: { scientificName: string; commonName: string }[],
  origin: string, destination: string, lang: string, month: number,
): string {
  const langName = LANG_NAMES[lang] || 'Spanish';
  const monthName = MONTH_NAMES[month];
  const plantList = plants.map((p, i) => `${i + 1}. ${p.commonName} (${p.scientificName})`).join('\n');

  const isZone = origin === destination;
  const routeContext = isZone
    ? `A person is exploring around ${origin} in ${monthName}.`
    : `A person is walking from ${origin} to ${destination} in ${monthName}.`;

  return `You are a botanist with a sharp sense of humor and a love for bad plant puns.
${routeContext}
IMPORTANT: Always use feminine gender when referring to the traveler in ${langName} text.

Here are 5 real plants found along this route:
${plantList}

For each plant, write TWO separate fields:
- "description": A surprising or little-known fact that makes this plant fascinating (2-3 sentences in ${langName}). Focus on ONE curiosity: a cultural or historical anecdote, an unusual survival trick, a weird use, a record, or a fun etymology. Avoid generic descriptions like "it's a common plant" — make the reader think "wow, I didn't know that!".
- "hint": Concrete visual clues to find and recognize this plant in the field (1-2 sentences in ${langName}). Mention leaf shape, flower color/size, typical height, and WHERE exactly to look (roadside, walls, shade, near water, forest edge...). If it can be confused with another plant, explain how to tell them apart.

Write ONLY a JSON object (no markdown, no backticks) with this format:
{
  "routeDescription": "A fun overview in ${langName} (2-3 sentences) about the landscape and environment along this route in ${monthName}.",
  "plants": [
    { "scientificName": "Latin name", "description": "...", "hint": "..." }
  ]
}

Include a "description" and "hint" for each of the 5 plants above, in the same order. The "scientificName" must match exactly.`;
}

// Fallback: full LLM prompt when no coordinates are available (original behavior)
function buildPlantPrompt(origin: string, destination: string, lang: string, month: number, exclude: string[]): string {
  const langName = LANG_NAMES[lang] || 'Spanish';
  const monthName = MONTH_NAMES[month];

  const exclusionBlock = exclude.length > 0
    ? `\n\nIMPORTANT: The traveler has already found these species on previous missions. Do NOT suggest any of them:\n${exclude.join(', ')}\n`
    : '';

  const isZone = origin === destination;
  const routeContext = isZone
    ? `A person is exploring around ${origin}.`
    : `A person is walking from ${origin} to ${destination}.`;
  const tooFarBlock = isZone
    ? ''
    : `\nIMPORTANT: If the origin and destination are very far apart (different countries, different climate zones, or more than ~100 km), set "tooFar" to true in your response and leave plants as an empty array. The description should explain in ${langName} that the mission crosses multiple climates and suggest picking a shorter route.`;

  return `You are a botanist expert on the flora in Europe, with a sharp sense of humor and a love for bad plant puns.
${routeContext}
The current month is ${monthName}. Only suggest plants that are visible, blooming, or identifiable during this time of year.
IMPORTANT: Always use feminine gender when referring to the traveler in ${langName} text.
${exclusionBlock}${tooFarBlock}

Suggest exactly 5 plants that can be found along this path in ${monthName}.
Consider the region, climate, season, and typical vegetation.
Try to include a balanced variety of plant types: trees, flowers, shrubs, grasses, herbs, ferns, etc. Don't force it if the route doesn't support it, but aim for diversity when possible.

For each plant, assign a rarity category:
- "common": easy to find, you'll likely spot it without trying
- "rare": you'll need to look carefully
- "veryRare": with a bit of luck you might find it

Sort the results from most common to rarest.

Each plant needs TWO separate text fields:
- "description": A surprising or little-known fact that makes this plant fascinating (2-3 sentences in ${langName}). Focus on ONE curiosity: a cultural or historical anecdote, an unusual survival trick, a weird use, a record, or a fun etymology. Avoid generic descriptions like "it's a common plant" — make the reader think "wow, I didn't know that!".
- "hint": Concrete visual clues to find and recognize this plant in the field (1-2 sentences in ${langName}). Mention leaf shape, flower color/size, typical height, and WHERE exactly to look (roadside, walls, shade, near water, forest edge...). If it can be confused with another plant, explain how to tell them apart.

Respond ONLY with a JSON object (no markdown, no backticks, no explanation), with this exact format:
{
  "tooFar": false,
  "description": "A brief overview in ${langName} (2-3 sentences) about the landscape and environment along this route in ${monthName}. Mention if the path goes through parks (name them!), forests, urban areas, farmland, coastal areas, etc. Is it lush? Dry? What should the user expect?",
  "plants": [
    {
      "commonName": "name in ${langName}",
      "scientificName": "Latin name",
      "rarity": "common",
      "description": "...",
      "hint": "..."
    }
  ]
}`;
}

// --- Photo helpers (unchanged) ---

// Clean botanical notation that Wikipedia doesn't understand:
// "Helleborus niger/orientalis" → "Helleborus niger"
// "Taraxacum officinale agg." → "Taraxacum officinale"
function cleanForWikipedia(name: string): string {
  return name
    .split('/')[0]
    .replace(/\s+(agg|s\.l|s\.s|var|subsp)\.?.*$/i, '')
    .trim();
}

// Fetch the hero image from Wikipedia (high-quality curated photo)
async function fetchFromWikipedia(scientificName: string): Promise<string> {
  try {
    const clean = cleanForWikipedia(scientificName);
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(clean)}`;
    const response = await fetch(url);
    if (!response.ok) return '';
    const data = await response.json();
    return data.originalimage?.source || '';
  } catch {
    return '';
  }
}

// Fetch up to 5 real photos from iNaturalist observations (free, no API key needed)
// Each observation has photos taken by real people in the field
// Uses "large" size (1024px) for better quality
async function fetchFromINaturalist(scientificName: string): Promise<string[]> {
  try {
    const url = `https://api.inaturalist.org/v1/observations?taxon_name=${encodeURIComponent(scientificName)}&photos=true&per_page=10&quality_grade=research&order_by=votes`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`iNaturalist returned ${response.status} for "${scientificName}"`);
      return [];
    }
    const data = await response.json();

    const urls: string[] = [];
    for (const obs of data.results || []) {
      for (const photo of obs.photos || []) {
        if (photo?.url && urls.length < 12) {
          urls.push(photo.url.replace('square', 'large'));
        }
      }
    }
    return urls;
  } catch (e) {
    console.error(`iNaturalist error for "${scientificName}":`, e);
    return [];
  }
}

// Fetch photos from Wikipedia + iNaturalist, returning { url, source }[] per plant
// Wikipedia first (best quality), then iNaturalist (more angles)
async function getPhotosForPlant(scientificName: string): Promise<PlantPhoto[]> {
  const [wikiUrl, iNatUrls] = await Promise.all([
    fetchFromWikipedia(scientificName),
    fetchFromINaturalist(scientificName),
  ]);

  const photos: PlantPhoto[] = [];
  if (wikiUrl) photos.push({ url: wikiUrl, source: 'wikipedia' });
  for (const url of iNatUrls) {
    if (url !== wikiUrl) photos.push({ url, source: 'inaturalist' });
  }
  return photos;
}

// Enrich all plants with photos and filter out any plant that has no photos
async function enrichPlantsWithPhotos(plants: any[]): Promise<any[]> {
  if (!Array.isArray(plants)) return [];
  const enriched = await Promise.all(
    plants.map(async (plant: any) => {
      const photos = await getPhotosForPlant(plant.scientificName);
      if (photos.length === 0) return null;
      return { ...plant, photos };
    })
  );
  return enriched.filter((p): p is NonNullable<typeof p> => p !== null);
}

// --- LLM-only fallback (original flow, used when no coordinates) ---

async function llmOnlyFlow(origin: string, destination: string, lang: string, month: number, exclude: string[]): Promise<SuggestedPlantsResult> {
  const prompt = buildPlantPrompt(origin, destination, lang, month, exclude);

  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  const text = (completion.choices[0]?.message?.content || '')
    .replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
  const parsed = JSON.parse(text);

  if (parsed.tooFar) {
    return { tooFar: true, description: parsed.description, plants: [] };
  }

  const plants = await enrichPlantsWithPhotos(parsed.plants);
  return { tooFar: false, description: parsed.description, plants };
}

// --- Public functions (exported = public, like public methods in Java) ---

// Must be called once after dotenv.config() has loaded the env vars
// Like a manual @PostConstruct
export function initPlantService(apiKey: string): void {
  groq = new Groq({ apiKey });
}

export interface SuggestedPlantsResult {
  tooFar: boolean;
  description: string;
  plants: any[];
}

export async function getSuggestedPlants(
  origin: string, destination: string, lang: string = 'es', month?: number, exclude: string[] = [],
  originLat?: number, originLng?: number, destLat?: number, destLng?: number,
): Promise<SuggestedPlantsResult> {
  const currentMonth = month || (new Date().getMonth() + 1);

  // Step 1: If no coordinates → fall back to LLM-only flow
  if (!originLat || !originLng || !destLat || !destLng) {
    return llmOnlyFlow(origin, destination, lang, currentMonth, exclude);
  }

  // Step 2: Check distance
  const distance = haversine(originLat, originLng, destLat, destLng);
  const isZone = origin === destination;

  // Step 3: Too far → return immediately without LLM call (skip for zone mode)
  if (!isZone && distance > 100) {
    return { tooFar: true, description: TOO_FAR[lang] || TOO_FAR['es'], plants: [] };
  }

  // Step 4: Compute midpoint and search radius (zone = fixed 10km around the point)
  const midLat = (originLat + destLat) / 2;
  const midLng = (originLng + destLng) / 2;
  const radius = isZone ? 10 : Math.max(5, Math.min(distance / 2, 50));

  // Step 5: Fetch species from iNaturalist
  const species = await fetchSpeciesCounts(midLat, midLng, radius, currentMonth, lang);

  // Step 6: If too few species → fall back to LLM-only
  if (species.length < 3) {
    return llmOnlyFlow(origin, destination, lang, currentMonth, exclude);
  }

  // Step 7: Select 10 diverse plants with rarity
  const selected = selectPlants(species, exclude);

  // Step 7b: Enrich with family taxonomy from iNaturalist
  await enrichWithTaxonomy(selected);

  // Step 8: Ask LLM for descriptions only
  const descPrompt = buildDescriptionPrompt(selected, origin, destination, lang, currentMonth);
  const completion = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{ role: 'user', content: descPrompt }],
    temperature: 0.7,
  });

  const text = (completion.choices[0]?.message?.content || '')
    .replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
  const llmResult = JSON.parse(text);

  // Step 9: Merge LLM descriptions with iNat plant data
  const descMap = new Map<string, { description: string; hint: string }>();
  for (const p of llmResult.plants || []) {
    descMap.set(p.scientificName, { description: p.description, hint: p.hint || '' });
  }

  const mergedPlants = selected.map(s => ({
    commonName: s.commonName,
    scientificName: s.scientificName,
    rarity: s.rarity,
    description: descMap.get(s.scientificName)?.description || '',
    hint: descMap.get(s.scientificName)?.hint || '',
    genus: s.genus,
    family: s.family,
  }));

  // Step 10: Enrich with Wikipedia + iNat observation photos
  const plants = await enrichPlantsWithPhotos(mergedPlants);
  return { tooFar: false, description: llmResult.routeDescription || '', plants };
}
