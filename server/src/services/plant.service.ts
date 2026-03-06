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
  es: 'Esa ruta cruza múltiples climas — prueba con una excursión más corta para que las sugerencias de plantas sean más precisas.',
  fr: 'Cet itinéraire traverse plusieurs climats — essayez une balade plus courte pour que les suggestions de plantes soient plus précises.',
};

// --- GBIF species discovery ---

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

function bboxPolygon(lat: number, lng: number, radiusKm: number): string {
  const latDelta = radiusKm / 111.32;
  const lngDelta = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));
  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;
  return `POLYGON((${minLng} ${minLat},${maxLng} ${minLat},${maxLng} ${maxLat},${minLng} ${maxLat},${minLng} ${minLat}))`;
}

async function fetchGbifSpecies(
  lat: number, lng: number, radiusKm: number, month: number,
): Promise<INatSpecies[]> {
  const geometry = bboxPolygon(lat, lng, radiusKm);
  const params = new URLSearchParams({
    taxonKey: '6',
    hasCoordinate: 'true',
    occurrenceStatus: 'PRESENT',
    month: String(month),
    geometry,
    facet: 'speciesKey',
    facetLimit: '300',
    limit: '0',
  });
  const url = `https://api.gbif.org/v1/occurrence/search?${params}`;
  console.log(`GBIF query: month=${month}, radius=${radiusKm}km around (${lat.toFixed(3)}, ${lng.toFixed(3)})`);
  const response = await fetch(url);
  if (!response.ok) {
    console.warn(`GBIF occurrence search returned ${response.status}`);
    return [];
  }
  const data = await response.json();

  const facets: { name: string; count: number }[] = data.facets?.[0]?.counts || [];
  if (facets.length === 0) return [];
  console.log(`GBIF returned ${facets.length} species facets`);

  // Resolve species in batches of 50 to avoid overwhelming the API
  const BATCH = 50;
  const allSpecies: INatSpecies[] = [];
  for (let i = 0; i < facets.length; i += BATCH) {
    const batch = facets.slice(i, i + BATCH);
    const results = await Promise.all(
      batch.map(async (f) => {
        try {
          const res = await fetch(`https://api.gbif.org/v1/species/${f.name}`);
          if (!res.ok) return null;
          const sp = await res.json();
          if (!sp.canonicalName || !sp.canonicalName.includes(' ')) return null;
          return {
            scientificName: sp.canonicalName,
            commonName: sp.canonicalName,
            count: f.count,
            photoUrl: '',
            taxonId: sp.key,
            genus: sp.genus || sp.canonicalName.split(' ')[0],
            family: sp.family || '',
          } as INatSpecies;
        } catch {
          return null;
        }
      })
    );
    allSpecies.push(...results.filter((s): s is INatSpecies => s !== null));
  }

  return allSpecies;
}

async function resolveCommonNames(
  plants: { scientificName: string; commonName: string; taxonId: number }[],
  lang: string,
): Promise<void> {
  const gbifLang = lang === 'es' ? 'spa' : lang === 'fr' ? 'fra' : 'eng';

  await Promise.all(
    plants.map(async (plant) => {
      try {
        const res = await fetch(`https://api.gbif.org/v1/species/${plant.taxonId}/vernacularNames`);
        if (!res.ok) return;
        const data = await res.json();
        const match = (data.results || []).find((v: any) => v.language === gbifLang);
        if (match?.vernacularName) {
          plant.commonName = match.vernacularName;
        }
      } catch {
        // will be resolved by LLM fallback below
      }
    })
  );

  const missing = plants.filter(p => p.commonName === p.scientificName);
  if (missing.length > 0) {
    const resolved = await lookupCommonNames(missing.map(p => p.scientificName), lang);
    for (const p of missing) {
      const name = resolved.get(p.scientificName);
      if (name) p.commonName = name;
    }
  }
}

async function lookupCommonNames(
  scientificNames: string[],
  lang: string,
): Promise<Map<string, string>> {
  const langName = LANG_NAMES[lang] || 'Spanish';
  const list = scientificNames.join(', ');
  const prompt = `Give me the common name in ${langName} for each of these plants. Return ONLY a JSON object mapping scientific name to common name, no markdown.\n\nPlants: ${list}`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });
    const text = (completion.choices[0]?.message?.content || '')
      .replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
    const obj = JSON.parse(text);
    return new Map(Object.entries(obj));
  } catch (e) {
    console.error('Error looking up common names:', e);
    return new Map();
  }
}

function assignRarity(count: number, maxCount: number): 'common' | 'rare' | 'veryRare' {
  const ratio = count / maxCount;
  // Combine absolute observation count with relative ratio
  // A plant with 20+ observations is common regardless of the top species
  if (count >= 20 || ratio > 0.3) return 'common';
  if (count >= 5 || ratio > 0.1) return 'rare';
  return 'veryRare';
}

const COMMON_FAMILIES = ['Asteraceae', 'Fabaceae', 'Lamiaceae', 'Brassicaceae', 'Apiaceae', 'Poaceae', 'Rosaceae'];

function selectPlants(species: INatSpecies[], exclude: string[], count: number = 5): (INatSpecies & { rarity: string; genus: string; family: string })[] {
  const excludeLower = new Set(exclude.map(n => n.toLowerCase()));
  const filtered = species.filter(s => !excludeLower.has(s.scientificName.toLowerCase()));
  if (filtered.length === 0) return [];

  const maxCount = Math.max(...filtered.map(s => s.count));
  const withRarity = filtered.map(s => ({ ...s, rarity: assignRarity(s.count, maxCount) }));

  const common = withRarity.filter(s => s.rarity === 'common');
  const rare = withRarity.filter(s => s.rarity === 'rare');
  const veryRare = withRarity.filter(s => s.rarity === 'veryRare');

  const nCommon = Math.round(count * 0.7);   // 7 for 10, 4 for 5
  const nHard = count - nCommon;              // 3 for 10, 1 for 5
  const nVeryRare = Math.min(veryRare.length, Math.max(1, Math.floor(nHard / 2)));
  const nRare = nHard - nVeryRare;

  const picked: (INatSpecies & { rarity: string })[] = [];
  picked.push(...common.slice(0, nCommon));
  picked.push(...rare.slice(0, nRare));
  picked.push(...veryRare.slice(0, nVeryRare));

  // If we didn't get enough, fill from remaining
  if (picked.length < count) {
    const pickedNames = new Set(picked.map(p => p.scientificName));
    for (const s of withRarity) {
      if (picked.length >= count) break;
      if (!pickedNames.has(s.scientificName)) picked.push(s);
    }
  }

  let result = picked.slice(0, count);

  // Ensure at least 5 plants from common European families (tutorial families)
  const minCommonFamilies = Math.min(5, count);
  const commonFamilyCount = result.filter(p => COMMON_FAMILIES.includes(p.family)).length;
  if (commonFamilyCount < minCommonFamilies) {
    const pickedNames = new Set(result.map(p => p.scientificName));
    const commonFamilyCandidates = withRarity
      .filter(s => COMMON_FAMILIES.includes(s.family) && !pickedNames.has(s.scientificName));

    // Replace non-common-family plants (from end) with common-family candidates
    let needed = minCommonFamilies - commonFamilyCount;
    let candidateIdx = 0;
    for (let i = result.length - 1; i >= 0 && needed > 0 && candidateIdx < commonFamilyCandidates.length; i--) {
      if (!COMMON_FAMILIES.includes(result[i].family)) {
        result[i] = commonFamilyCandidates[candidateIdx++];
        needed--;
      }
    }
  }

  return result;
}

// --- LLM prompts ---

// Description-only prompt: the LLM adds fun descriptions to real iNaturalist plants
function buildDescriptionPrompt(
  plants: { scientificName: string; commonName: string }[],
  origin: string, destination: string, lang: string, month: number, count: number = 5,
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

Here are ${count} real plants found along this route:
${plantList}

For each plant, write TWO separate fields that must contain COMPLETELY DIFFERENT information — no overlap allowed:

- "description": ONE fascinating anecdote (2-3 sentences in ${langName}). Pick from: a historical or cultural story, an unusual human use (medicine, cuisine, dye, poison...), a surprising ecological relationship (pollination trick, symbiosis, invasive behavior), a world record, or a fun etymology. NEVER mention the plant's physical appearance here — no colors, shapes, sizes, or habitat.

- "hint": A practical field identification guide (1-2 sentences in ${langName}). Describe ONLY what to look for with your eyes: leaf shape (lobed, toothed, opposite vs alternate), flower structure (number of petals, symmetry, color), stem features (square, hairy, hollow), smell if distinctive, typical height, and WHERE to look (roadside, walls, shade, wet soil, forest edge...). NEVER mention history, uses, culture, or fun facts here.

STRICT RULES:
- If the description mentions a use or story, the hint must NOT repeat it. If the hint mentions a visual feature, the description must NOT mention it.
- NEVER start a description or hint with the plant's name. The name is already displayed separately in the UI. Jump straight into the fact or the visual clue. Bad: "La lavande est utilisée..." Good: "Utilisée depuis l'Antiquité..."

STYLE RULES for ${langName} text:
- Write about the PLANTS, not about the traveler. Do not address or mention the user/traveler in descriptions or hints.
- If you must refer to a person (only in the routeDescription), use feminine gender.

Write ONLY a JSON object (no markdown, no backticks) with this format:
{
  "routeDescription": "A fun overview in ${langName} (2-3 sentences) about the landscape and environment along this route in ${monthName}.",
  "plants": [
    { "scientificName": "Latin name", "description": "...", "hint": "..." }
  ]
}

Include a "description" and "hint" for each of the ${count} plants above, in the same order. The "scientificName" must match exactly.`;
}

// Fallback: full LLM prompt when no coordinates are available (original behavior)
function buildPlantPrompt(origin: string, destination: string, lang: string, month: number, exclude: string[], count: number = 5): string {
  const langName = LANG_NAMES[lang] || 'Spanish';
  const monthName = MONTH_NAMES[month];

  const exclusionBlock = exclude.length > 0
    ? `\n\nIMPORTANT: The traveler has already found these species on previous treks. Do NOT suggest any of them:\n${exclude.join(', ')}\n`
    : '';

  const isZone = origin === destination;
  const routeContext = isZone
    ? `A person is exploring around ${origin}.`
    : `A person is walking from ${origin} to ${destination}.`;
  const tooFarBlock = isZone
    ? ''
    : `\nIMPORTANT: If the origin and destination are very far apart (different countries, different climate zones, or more than ~100 km), set "tooFar" to true in your response and leave plants as an empty array. The description should explain in ${langName} that the trek crosses multiple climates and suggest picking a shorter route.`;

  return `You are a botanist expert on the flora in Europe, with a sharp sense of humor and a love for bad plant puns.
${routeContext}
The current month is ${monthName}. Only suggest plants that are visible, blooming, or identifiable during this time of year.
${exclusionBlock}${tooFarBlock}

Suggest exactly ${count} plants that can be found along this path in ${monthName}.
Consider the region, climate, season, and typical vegetation.
Try to include a balanced variety of plant types: trees, flowers, shrubs, grasses, herbs, ferns, etc. Don't force it if the route doesn't support it, but aim for diversity when possible.

IMPORTANT: At least 5 of the ${count} plants MUST belong to one of these common European families: Asteraceae, Fabaceae, Lamiaceae, Brassicaceae, Apiaceae, Poaceae, or Rosaceae. Include the "family" field for each plant.

For each plant, assign a rarity category based on how frequently it is encountered in the wild in this region:
- "common": widespread and abundant — you'll see it without trying. Examples: dandelion, clover, daisy, plantain, grass species, common poppy, nettle, ivy, bramble.
- "rare": present in the area but you need to pay attention to spot it.
- "veryRare": uncommon, localized, or easily overlooked — finding it requires luck or specific habitat knowledge.

Be realistic: well-known European wildflowers and weeds are ALWAYS "common". Reserve "rare" and "veryRare" for plants that genuinely require effort to find.

Sort the results from most common to rarest.

Each plant needs TWO separate text fields that must contain COMPLETELY DIFFERENT information — no overlap allowed:

- "description": ONE fascinating anecdote (2-3 sentences in ${langName}). Pick from: a historical or cultural story, an unusual human use (medicine, cuisine, dye, poison...), a surprising ecological relationship (pollination trick, symbiosis, invasive behavior), a world record, or a fun etymology. NEVER mention the plant's physical appearance here — no colors, shapes, sizes, or habitat.

- "hint": A practical field identification guide (1-2 sentences in ${langName}). Describe ONLY what to look for with your eyes: leaf shape (lobed, toothed, opposite vs alternate), flower structure (number of petals, symmetry, color), stem features (square, hairy, hollow), smell if distinctive, typical height, and WHERE to look (roadside, walls, shade, wet soil, forest edge...). NEVER mention history, uses, culture, or fun facts here.

STRICT RULES:
- If the description mentions a use or story, the hint must NOT repeat it. If the hint mentions a visual feature, the description must NOT mention it.
- NEVER start a description or hint with the plant's name. The name is already displayed separately in the UI. Jump straight into the fact or the visual clue. Bad: "La lavande est utilisée..." Good: "Utilisée depuis l'Antiquité..."

STYLE RULES for ${langName} text:
- Write about the PLANTS, not about the traveler. Do not address or mention the user/traveler in descriptions or hints.
- If you must refer to a person (only in the route description field), use feminine gender.

Respond ONLY with a JSON object (no markdown, no backticks, no explanation), with this exact format:
{
  "tooFar": false,
  "description": "A brief overview in ${langName} (2-3 sentences) about the landscape and environment along this route in ${monthName}. Mention if the path goes through parks (name them!), forests, urban areas, farmland, coastal areas, etc. Is it lush? Dry? What should the user expect?",
  "plants": [
    {
      "commonName": "name in ${langName}",
      "scientificName": "Latin name",
      "family": "Asteraceae",
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
export async function fetchFromWikipedia(scientificName: string): Promise<string> {
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
export async function fetchFromINaturalist(scientificName: string): Promise<string[]> {
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

async function llmOnlyFlow(origin: string, destination: string, lang: string, month: number, exclude: string[], count: number = 5): Promise<SuggestedPlantsResult> {
  const prompt = buildPlantPrompt(origin, destination, lang, month, exclude, count);

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

  // Add genus from scientific name for LLM-generated plants (family will be looked up at identify time)
  const withGenus = (parsed.plants || []).map((p: any) => ({
    ...p,
    genus: p.genus || (p.scientificName ? p.scientificName.trim().split(/\s+/)[0] : ''),
    family: p.family || '',
  }));

  const plants = await enrichPlantsWithPhotos(withGenus);
  return { tooFar: false, description: parsed.description, plants };
}

// --- Lazy-load canonical plant photo ---

import type { PrismaClient } from '../generated/prisma/client';

// Ensure a canonical Plant has a photo; fetches from Wikipedia/iNaturalist if missing
export async function ensurePlantPhoto(
  plant: { id: number; photoUrl: string | null; scientificName: string },
  prisma: PrismaClient,
): Promise<string | null> {
  if (plant.photoUrl) return plant.photoUrl;

  // Try Wikipedia first (high-quality curated photo)
  let url = await fetchFromWikipedia(plant.scientificName);
  let source = 'wikipedia';

  // Fallback to iNaturalist
  if (!url) {
    const iNatUrls = await fetchFromINaturalist(plant.scientificName);
    if (iNatUrls.length > 0) {
      url = iNatUrls[0];
      source = 'inaturalist';
    }
  }

  if (url) {
    await prisma.plant.update({
      where: { id: plant.id },
      data: { photoUrl: url, photoSource: source },
    });
    return url;
  }

  return null;
}

// --- Public functions (exported = public, like public methods in Java) ---

// Must be called once after dotenv.config() has loaded the env vars
// Like a manual @PostConstruct
export function initPlantService(apiKey: string): void {
  groq = new Groq({ apiKey });
}

/**
 * Translate plant common names from English to the target language using Groq.
 * Returns a map of scientificName → translated common name.
 */
export async function translatePlantNames(
  plants: { scientificName: string; commonName: string }[],
  lang: string,
): Promise<Map<string, string>> {
  if (plants.length === 0) return new Map();

  const langName = LANG_NAMES[lang] || 'Spanish';
  const list = plants.map(p => `- ${p.scientificName}: ${p.commonName}`).join('\n');

  const prompt = `Translate these plant common names from English to ${langName}. Return ONLY a JSON array of objects with "scientificName" and "commonName" (translated). Keep scientific names unchanged.\n\n${list}`;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const text = (completion.choices[0]?.message?.content || '')
      .replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
    const result: { scientificName: string; commonName: string }[] = JSON.parse(text);

    const map = new Map<string, string>();
    for (const r of result) {
      if (r.scientificName && r.commonName) {
        map.set(r.scientificName, r.commonName);
      }
    }
    return map;
  } catch (e) {
    console.error('Error translating plant names:', e);
    return new Map();
  }
}

export interface SuggestedPlantsResult {
  tooFar: boolean;
  description: string;
  plants: any[];
}

export async function getSuggestedPlants(
  origin: string, destination: string, lang: string = 'es', month?: number, exclude: string[] = [],
  originLat?: number, originLng?: number, destLat?: number, destLng?: number, count: number = 5,
): Promise<SuggestedPlantsResult> {
  const currentMonth = month || (new Date().getMonth() + 1);

  // Step 1: If no coordinates → fall back to LLM-only flow
  if (!originLat || !originLng || !destLat || !destLng) {
    return llmOnlyFlow(origin, destination, lang, currentMonth, exclude, count);
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

  // Step 5: Fetch species from GBIF (up to 300 species in one call)
  const species = await fetchGbifSpecies(midLat, midLng, radius, currentMonth);

  // Step 6: If too few species → fall back to LLM-only
  if (species.length < 3) {
    return llmOnlyFlow(origin, destination, lang, currentMonth, exclude, count);
  }

  // Step 7: Select diverse plants with rarity, prioritizing common European families
  const selected = selectPlants(species, exclude, count);
  console.log(`GBIF: ${species.length} species total, ${selected.length}/${count} after exclusion`);

  // If not enough after exclusion → fall back to LLM-only
  if (selected.length === 0) {
    return llmOnlyFlow(origin, destination, lang, currentMonth, exclude, count);
  }

  // Step 7b: Resolve common names in the user's language (GBIF + LLM fallback)
  await resolveCommonNames(selected, lang);

  // Step 8: Ask LLM for descriptions only
  const descPrompt = buildDescriptionPrompt(selected, origin, destination, lang, currentMonth, count);
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
