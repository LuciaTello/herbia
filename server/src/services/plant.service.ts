// PlantService: like a @Service class in Spring
// Contains the business logic for plant suggestions (Gemini AI + Wikipedia images)

import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';

// Gemini model - initialized later by initPlantService() after dotenv has loaded
// In Java this wouldn't be a problem because Spring resolves everything before starting,
// but in Node.js, module-level code runs BEFORE dotenv.config()
let model: GenerativeModel;

// --- Private functions (not exported = private, like private methods in Java) ---

const LANG_NAMES: Record<string, string> = {
  es: 'Spanish',
  fr: 'French',
};

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function buildPlantPrompt(origin: string, destination: string, lang: string, month: number): string {
  const langName = LANG_NAMES[lang] || 'Spanish';
  const monthName = MONTH_NAMES[month];
  return `You are a botanist expert on the flora in Europe, with a sharp sense of humor and a love for bad plant puns.
A pilgrim is walking from ${origin} to ${destination} (likely on the Camino de Santiago or a similar route).
The current month is ${monthName}. Only suggest plants that are visible, blooming, or identifiable during this time of year.

Suggest exactly 10 plants that can be found along this path in ${monthName}.
Consider the region, climate, season, and typical vegetation.

For each plant, estimate a realistic percentage chance (0-100%) that a pilgrim would actually spot it on this specific route.
Sort the results in DESCENDING order by this percentage (most common first, rarest last).

The description should be informative but also fun and slightly humorous — a joke, a pun, a witty remark about the plant or the pilgrim's suffering. Keep it light but still useful.

Respond ONLY with a JSON object (no markdown, no backticks, no explanation), with this exact format:
{
  "description": "A brief overview in ${langName} (2-3 sentences) about the general vegetation and conditions along this route in ${monthName}. Is it lush? Dry? What should the pilgrim expect?",
  "plants": [
    {
      "commonName": "name in ${langName}",
      "scientificName": "Latin name",
      "chancePercent": 42,
      "description": "Brief description in ${langName} (2-3 sentences). Mention what it looks like, where to find it, and include a touch of humor."
    }
  ]
}`;
}

// Fetch up to 5 real photos from iNaturalist observations (free, no API key needed)
// Each observation has photos taken by real people in the field — much better than Wikipedia thumbnails
async function getINaturalistImages(scientificName: string): Promise<string[]> {
  try {
    const url = `https://api.inaturalist.org/v1/observations?taxon_name=${encodeURIComponent(scientificName)}&photos=true&per_page=5&quality_grade=research&order_by=votes`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`iNaturalist returned ${response.status} for "${scientificName}"`);
      return [];
    }
    const data = await response.json();

    // Each observation has a photos array; take the first photo from each observation
    // Replace "square" with "medium" for better resolution
    const urls: string[] = [];
    for (const obs of data.results || []) {
      const photo = obs.photos?.[0];
      if (photo?.url) {
        urls.push(photo.url.replace('square', 'medium'));
      }
    }
    console.log(`iNaturalist: ${urls.length} photos for "${scientificName}"`);
    return urls;
  } catch (e) {
    console.error(`iNaturalist error for "${scientificName}":`, e);
    return [];
  }
}

async function enrichPlantsWithImages(plants: any[]): Promise<any[]> {
  if (!Array.isArray(plants)) return [];
  return Promise.all(
    plants.map(async (plant: any) => {
      const imageUrls = await getINaturalistImages(plant.scientificName);
      return { ...plant, imageUrls };
    })
  );
}

// --- Public functions (exported = public, like public methods in Java) ---

// Must be called once after dotenv.config() has loaded the env vars
// Like a manual @PostConstruct
export function initPlantService(apiKey: string): void {
  const genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

export interface SuggestedPlantsResult {
  description: string;
  plants: any[];
}

export async function getSuggestedPlants(origin: string, destination: string, lang: string = 'es', month?: number): Promise<SuggestedPlantsResult> {
  // getMonth() returns 0-11 (Jan=0), so +1 to get 1-12 like our DB stores
  const currentMonth = month || (new Date().getMonth() + 1);
  const prompt = buildPlantPrompt(origin, destination, lang, currentMonth);
  const result = await model.generateContent(prompt);
  // Gemini sometimes wraps JSON in ```json ... ``` markdown blocks — strip them
  const text = result.response.text().replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
  const parsed = JSON.parse(text);
  const plants = await enrichPlantsWithImages(parsed.plants);
  return { description: parsed.description, plants };
}
