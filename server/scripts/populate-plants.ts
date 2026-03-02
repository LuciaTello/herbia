// Populate the canonical `plants` table with ~2000 common species from GBIF
// Run with: npx tsx server/scripts/populate-plants.ts

import dotenv from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env['DATABASE_URL']! });
const prisma = new PrismaClient({ adapter });

interface GBIFFacet {
  counts: { name: string; count: number }[];
}

interface GBIFSpecies {
  key: number;
  scientificName: string;
  canonicalName?: string;
  genus?: string;
  family?: string;
  vernacularNames?: { vernacularName: string; language: string }[];
}

// Step 1: Get top speciesKeys from occurrence facets for a country
async function fetchTopSpeciesKeys(countryCode: string, limit: number): Promise<number[]> {
  const url = `https://api.gbif.org/v1/occurrence/search?country=${countryCode}&taxonKey=6&hasCoordinate=true&limit=0&facet=speciesKey&facetLimit=${limit}`;
  console.log(`  Fetching top ${limit} species for ${countryCode}...`);
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`  GBIF occurrence search failed for ${countryCode}: ${res.status}`);
    return [];
  }
  const data = await res.json();
  const facets: GBIFFacet[] = data.facets || [];
  const speciesFacet = facets.find((f: any) => f.field === 'SPECIES_KEY');
  if (!speciesFacet) return [];
  return speciesFacet.counts.map(c => parseInt(c.name));
}

// Step 2: Get species details (taxonomy + vernacular names)
async function fetchSpeciesDetails(key: number): Promise<{
  scientificName: string;
  genus: string;
  family: string;
  commonNameEs: string | null;
  commonNameFr: string | null;
} | null> {
  try {
    const [speciesRes, vernacularRes] = await Promise.all([
      fetch(`https://api.gbif.org/v1/species/${key}`),
      fetch(`https://api.gbif.org/v1/species/${key}/vernacularNames?limit=100`),
    ]);

    if (!speciesRes.ok) return null;
    const species: GBIFSpecies = await speciesRes.json();
    const canonicalName = species.canonicalName || species.scientificName;

    // Skip if no canonical name or if it's higher than species level
    if (!canonicalName || !canonicalName.includes(' ')) return null;

    let commonNameEs: string | null = null;
    let commonNameFr: string | null = null;

    if (vernacularRes.ok) {
      const vData = await vernacularRes.json();
      for (const v of vData.results || []) {
        if (!commonNameEs && v.language === 'spa') commonNameEs = v.vernacularName;
        if (!commonNameFr && v.language === 'fra') commonNameFr = v.vernacularName;
        if (commonNameEs && commonNameFr) break;
      }
    }

    return {
      scientificName: canonicalName,
      genus: species.genus || canonicalName.split(' ')[0],
      family: species.family || '',
      commonNameEs,
      commonNameFr,
    };
  } catch (e) {
    console.warn(`  Failed to fetch species ${key}:`, e);
    return null;
  }
}

async function main() {
  console.log('Populating plants table from GBIF...\n');

  // Fetch top species from FR and ES
  const [frKeys, esKeys] = await Promise.all([
    fetchTopSpeciesKeys('FR', 1200),
    fetchTopSpeciesKeys('ES', 1200),
  ]);

  console.log(`  FR: ${frKeys.length} species keys, ES: ${esKeys.length} species keys`);

  // Deduplicate
  const allKeys = [...new Set([...frKeys, ...esKeys])];
  console.log(`  Combined unique: ${allKeys.length} species keys\n`);

  // Fetch details in batches of 20 (respect GBIF rate limits)
  const BATCH_SIZE = 20;
  const plants: {
    scientificName: string;
    genus: string;
    family: string;
    commonNameEs: string | null;
    commonNameFr: string | null;
  }[] = [];

  for (let i = 0; i < allKeys.length; i += BATCH_SIZE) {
    const batch = allKeys.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(fetchSpeciesDetails));

    for (const r of results) {
      if (r) plants.push(r);
    }

    const progress = Math.min(i + BATCH_SIZE, allKeys.length);
    process.stdout.write(`\r  Fetched ${progress}/${allKeys.length} species (${plants.length} valid)`);

    // Small delay between batches to be polite to GBIF API
    if (i + BATCH_SIZE < allKeys.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`\n\n  Inserting ${plants.length} plants into database...`);

  // Deduplicate by scientificName (in case GBIF returned duplicates)
  const seen = new Set<string>();
  const unique = plants.filter(p => {
    const key = p.scientificName.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Insert in batches with skipDuplicates
  const INSERT_BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < unique.length; i += INSERT_BATCH) {
    const batch = unique.slice(i, i + INSERT_BATCH);
    const result = await prisma.plant.createMany({
      data: batch.map(p => ({
        scientificName: p.scientificName,
        commonNameEs: p.commonNameEs,
        commonNameFr: p.commonNameFr,
        genus: p.genus,
        family: p.family,
      })),
      skipDuplicates: true,
    });
    inserted += result.count;
  }

  console.log(`  Inserted ${inserted} new plants (${unique.length - inserted} already existed)\n`);

  // Show stats
  const total = await prisma.plant.count();
  const withFamily = await prisma.plant.count({ where: { family: { not: '' } } });
  const withEs = await prisma.plant.count({ where: { commonNameEs: { not: null } } });
  const withFr = await prisma.plant.count({ where: { commonNameFr: { not: null } } });
  console.log(`  Total plants: ${total}`);
  console.log(`  With family: ${withFamily}`);
  console.log(`  With Spanish name: ${withEs}`);
  console.log(`  With French name: ${withFr}`);

  await prisma.$disconnect();
  console.log('\nDone!');
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
