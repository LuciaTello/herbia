// PlantService: like a @Service class in Spring
// Contains the business logic for plant suggestions (Gemini AI + Wikipedia images)

import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';

// Gemini model - initialized later by initPlantService() after dotenv has loaded
// In Java this wouldn't be a problem because Spring resolves everything before starting,
// but in Node.js, module-level code runs BEFORE dotenv.config()
let model: GenerativeModel;

// --- Private functions (not exported = private, like private methods in Java) ---

function buildPlantPrompt(origin: string, destination: string): string {
  return `You are a botanist expert on the flora in Europe.
A pilgrim is walking from ${origin} to ${destination} (likely on the Camino de Santiago or a similar route).

Suggest exactly 3 plants that are common and easy to find along this path.
Consider the region, climate, and typical vegetation.

Respond ONLY with a JSON array (no markdown, no backticks, no explanation), with this exact format:
[
  {
    "commonName": "name in Spanish",
    "scientificName": "Latin name",
    "description": "Brief description in Spanish (2-3 sentences). Mention what it looks like and where to find it."
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

export async function getSuggestedPlants(origin: string, destination: string): Promise<any[]> {
  const prompt = buildPlantPrompt(origin, destination);
  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const plants = JSON.parse(text);
  return enrichPlantsWithImages(plants);
}
