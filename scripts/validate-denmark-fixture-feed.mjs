import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const stadiums = JSON.parse(fs.readFileSync(path.join(rootDir, 'data', 'stadiums.json'), 'utf8'));
const envelope = JSON.parse(
  fs.readFileSync(
    path.join(rootDir, 'public', 'reference-data', 'fixtures.denmark.remote.json'),
    'utf8'
  )
);
const fixtures = envelope.fixtures;

if (!Array.isArray(fixtures) || fixtures.length === 0) {
  throw new Error('The Danish fixture feed is empty or invalid');
}

const danishClubIds = new Set(
  stadiums
    .filter((stadium) => stadium.countryCode?.toLowerCase() === 'dk')
    .map((stadium) => stadium.id)
);
const fixtureIds = new Set();

for (const fixture of fixtures) {
  if (fixtureIds.has(fixture.id)) {
    throw new Error(`Duplicate fixture id in Danish feed: ${fixture.id}`);
  }
  fixtureIds.add(fixture.id);

  for (const clubId of [fixture.homeTeamId, fixture.awayTeamId, fixture.venueClubId]) {
    if (!danishClubIds.has(clubId)) {
      throw new Error(`Non-Danish or unknown club id in Danish feed: ${clubId}`);
    }
  }
}

const checksum = crypto
  .createHash('sha256')
  .update(JSON.stringify(fixtures))
  .digest('hex');

if (envelope.metadata?.checksum !== checksum) {
  throw new Error('Danish fixture feed checksum does not match its fixture payload');
}

console.log(`Validated Danish fixtures: ${fixtures.length}`);
console.log(`Validated Danish clubs: ${danishClubIds.size}`);
console.log(`Version: ${envelope.metadata.version}`);
