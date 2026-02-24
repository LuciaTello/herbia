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

function buildPlantPrompt(origin: string, destination: string, lang: string): string {
  const langName = LANG_NAMES[lang] || 'Spanish';
  return `You are a botanist expert on the flora in Europe, with a sharp sense of humor and a love for bad plant puns.
A pilgrim is walking from ${origin} to ${destination} (likely on the Camino de Santiago or a similar route).

Suggest exactly 10 plants that can be found along this path.
Consider the region, climate, and typical vegetation.

For each plant, estimate a realistic percentage chance (0-100%) that a pilgrim would actually spot it on this specific route.
Sort the results in ASCENDING order by this percentage (rarest first, most common last).

The description should be informative but also fun and slightly humorous — a joke, a pun, a witty remark about the plant or the pilgrim's suffering. Keep it light but still useful.

Respond ONLY with a JSON array (no markdown, no backticks, no explanation), with this exact format:
[
  {
    "commonName": "name in ${langName}",
    "scientificName": "Latin name",
    "chancePercent": 42,
    "description": "Brief description in ${langName} (2-3 sentences). Mention what it looks like, where to find it, and include a touch of humor."
  }
]`;
}

async function getWikipediaImage(scientificName: string): Promise<string> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(scientificName)}`;
    const response = await fetch(url);
    if (!response.ok) { return ''; }
    const data = await response.json();
    return data.thumbnail?.source || '';
  } catch {
    return '';
  }
}

async function enrichPlantsWithImages(plants: any[]): Promise<any[]> {
  return Promise.all(
    plants.map(async (plant: any) => {
      const imageUrl = await getWikipediaImage(plant.scientificName);
      return { ...plant, imageUrl };
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

export async function getSuggestedPlants(origin: string, destination: string, lang: string = 'es'): Promise<any[]> {
  const prompt = buildPlantPrompt(origin, destination, lang);
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const plants = JSON.parse(text);
  return enrichPlantsWithImages(plants);
}
