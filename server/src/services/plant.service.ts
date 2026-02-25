// PlantService: like a @Service class in Spring
// Contains the business logic for plant suggestions (Groq/Llama AI + Wikipedia/iNaturalist images)

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

function buildPlantPrompt(origin: string, destination: string, lang: string, month: number, exclude: string[]): string {
  const langName = LANG_NAMES[lang] || 'Spanish';
  const monthName = MONTH_NAMES[month];

  const exclusionBlock = exclude.length > 0
    ? `\n\nIMPORTANT: The traveler has already found these species on previous treks. Do NOT suggest any of them:\n${exclude.join(', ')}\n`
    : '';

  return `You are a botanist expert on the flora in Europe, with a sharp sense of humor and a love for bad plant puns.
A person is walking from ${origin} to ${destination}.
The current month is ${monthName}. Only suggest plants that are visible, blooming, or identifiable during this time of year.
IMPORTANT: Always use feminine gender when referring to the traveler in ${langName} text.
${exclusionBlock}
IMPORTANT: If the origin and destination are very far apart (different countries, different climate zones, or more than ~100 km), set "tooFar" to true in your response and leave plants as an empty array. The description should explain in ${langName} that the trek crosses multiple climates and suggest picking a shorter route.

Suggest exactly 10 plants that can be found along this path in ${monthName}.
Consider the region, climate, season, and typical vegetation.
Try to include a balanced variety of plant types: trees, flowers, shrubs, grasses, herbs, ferns, etc. Don't force it if the route doesn't support it, but aim for diversity when possible.

For each plant, assign a rarity category:
- "common": easy to find, you'll likely spot it without trying
- "rare": you'll need to look carefully
- "veryRare": with a bit of luck you might find it

Sort the results from most common to rarest.

The description should be informative but also fun and slightly humorous — a joke, a pun, a witty remark about the plant or the user's suffering. Keep it light but still useful.

Respond ONLY with a JSON object (no markdown, no backticks, no explanation), with this exact format:
{
  "tooFar": false,
  "description": "A brief overview in ${langName} (2-3 sentences) about the landscape and environment along this route in ${monthName}. Mention if the path goes through parks (name them!), forests, urban areas, farmland, coastal areas, etc. Is it lush? Dry? What should the user expect?",
  "plants": [
    {
      "commonName": "name in ${langName}",
      "scientificName": "Latin name",
      "rarity": "common",
      "description": "Brief description in ${langName} (2-3 sentences). Mention what it looks like, where to find it, and include a touch of humor."
    }
  ]
}`;
}

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
    const url = `https://api.inaturalist.org/v1/observations?taxon_name=${encodeURIComponent(scientificName)}&photos=true&per_page=5&quality_grade=research&order_by=votes`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`iNaturalist returned ${response.status} for "${scientificName}"`);
      return [];
    }
    const data = await response.json();

    const urls: string[] = [];
    for (const obs of data.results || []) {
      const photo = obs.photos?.[0];
      if (photo?.url) {
        urls.push(photo.url.replace('square', 'large'));
      }
    }
    console.log(`iNaturalist: ${urls.length} photos for "${scientificName}"`);
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

export async function getSuggestedPlants(origin: string, destination: string, lang: string = 'es', month?: number, exclude: string[] = []): Promise<SuggestedPlantsResult> {
  // getMonth() returns 0-11 (Jan=0), so +1 to get 1-12 like our DB stores
  const currentMonth = month || (new Date().getMonth() + 1);
  const prompt = buildPlantPrompt(origin, destination, lang, currentMonth, exclude);

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
