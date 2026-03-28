import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function readJson(relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

const stadiums = readJson('data/stadiums.json');
const fixtures = readJson('data/fixtures.json');

const allowedLeagues = ['Superliga', '1. division', '2. division', '3. division'];
const stadiumIds = new Set(stadiums.map((stadium) => stadium.id));
const fixtureIds = new Set();
const stadiumNames = new Set();
const errors = [];
const warnings = [];

for (const stadium of stadiums) {
  if (!stadium.id) errors.push('Stadium mangler id');
  if (stadium.id && stadiumIds.size !== stadiums.length) {
    // håndteres mere præcist nedenfor via duplicate-id check
  }
  if (!stadium.name) errors.push(`Stadium ${stadium.id ?? '<ukendt>'} mangler name`);
  if (!stadium.team) errors.push(`Stadium ${stadium.id ?? '<ukendt>'} mangler team`);
  if (!allowedLeagues.includes(stadium.league)) {
    errors.push(`Stadium ${stadium.id} har ugyldig league: ${stadium.league}`);
  }
  if (typeof stadium.id === 'string') {
    if (stadium.id !== stadium.id.trim()) {
      errors.push(`Stadium ${stadium.id} har whitespace i id`);
    }
    if (stadium.id !== stadium.id.toLowerCase()) {
      warnings.push(`Stadium ${stadium.id} er ikke lowercase`);
    }
  }
  if (typeof stadium.name === 'string') {
    const normalizedName = stadium.name.trim().toLowerCase();
    if (stadiumNames.has(normalizedName)) {
      warnings.push(`Mulig dublet stadium.name: ${stadium.name}`);
    } else {
      stadiumNames.add(normalizedName);
    }
  }
  if (typeof stadium.lat !== 'number' || typeof stadium.lon !== 'number') {
    warnings.push(`Stadium ${stadium.id} mangler gyldige koordinater`);
  } else {
    if (stadium.lat < -90 || stadium.lat > 90) {
      errors.push(`Stadium ${stadium.id} har ugyldig lat: ${stadium.lat}`);
    }
    if (stadium.lon < -180 || stadium.lon > 180) {
      errors.push(`Stadium ${stadium.id} har ugyldig lon: ${stadium.lon}`);
    }
  }
}

if (stadiumIds.size !== stadiums.length) {
  const seen = new Set();
  for (const stadium of stadiums) {
    if (!stadium.id) continue;
    if (seen.has(stadium.id)) {
      errors.push(`Dublet stadium.id: ${stadium.id}`);
    } else {
      seen.add(stadium.id);
    }
  }
}

for (const fixture of fixtures) {
  if (!fixture.id) {
    errors.push('Fixture mangler id');
    continue;
  }

  if (fixtureIds.has(fixture.id)) {
    errors.push(`Dublet fixture.id: ${fixture.id}`);
  } else {
    fixtureIds.add(fixture.id);
  }

  if (!fixture.kickoff || Number.isNaN(Date.parse(fixture.kickoff))) {
    errors.push(`Fixture ${fixture.id} har ugyldigt kickoff: ${fixture.kickoff}`);
  }

  if (typeof fixture.id === 'string') {
    if (fixture.id !== fixture.id.trim()) {
      errors.push(`Fixture ${fixture.id} har whitespace i id`);
    }
  }

  for (const field of ['venueClubId', 'homeTeamId', 'awayTeamId']) {
    const value = fixture[field];
    if (!value) {
      errors.push(`Fixture ${fixture.id} mangler ${field}`);
      continue;
    }
    if (!stadiumIds.has(value)) {
      errors.push(`Fixture ${fixture.id} peger på ukendt ${field}: ${value}`);
    }
  }

  if (fixture.homeTeamId && fixture.awayTeamId && fixture.homeTeamId === fixture.awayTeamId) {
    warnings.push(`Fixture ${fixture.id} har samme hjemme- og udehold: ${fixture.homeTeamId}`);
  }

  if (fixture.venueClubId && fixture.homeTeamId && fixture.venueClubId !== fixture.homeTeamId) {
    warnings.push(
      `Fixture ${fixture.id} har venueClubId ${fixture.venueClubId} som ikke matcher homeTeamId ${fixture.homeTeamId}`
    );
  }

  if (!fixture.round) {
    warnings.push(`Fixture ${fixture.id} mangler round`);
  }

  if (!fixture.status) {
    warnings.push(`Fixture ${fixture.id} mangler status`);
  } else if (!['scheduled', 'finished', 'postponed', 'cancelled'].includes(fixture.status)) {
    warnings.push(`Fixture ${fixture.id} har uventet status: ${fixture.status}`);
  }
}

console.log(`Stadiums: ${stadiums.length}`);
console.log(`Fixtures: ${fixtures.length}`);
console.log(`Allowed leagues: ${allowedLeagues.join(', ')}`);

if (warnings.length > 0) {
  console.log(`Warnings: ${warnings.length}`);
  for (const warning of warnings) {
    console.log(`WARN  ${warning}`);
  }
}

if (errors.length > 0) {
  console.error(`Errors: ${errors.length}`);
  for (const error of errors) {
    console.error(`ERROR ${error}`);
  }
  process.exit(1);
}

console.log('Reference-data validation passed');
