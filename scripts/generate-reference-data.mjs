import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const websiteRootDir = path.resolve(__dirname, '..');
const workspaceRootDir = path.resolve(websiteRootDir, '..');
const appDir = path.join(workspaceRootDir, 'Tribunetour');

const stadiumsCsvPath = path.join(appDir, 'stadiums.csv');
const fixturesCsvPath = path.join(appDir, 'fixtures.csv');
const stadiumsJsonPath = path.join(websiteRootDir, 'data', 'stadiums.json');
const fixturesJsonPath = path.join(websiteRootDir, 'data', 'fixtures.json');
const remoteFixturesJsonPath = path.join(websiteRootDir, 'public', 'reference-data', 'fixtures.remote.json');
const leaguePacksDir = path.join(websiteRootDir, 'data', 'league-packs');

function splitCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }

    current += character;
  }

  result.push(current.trim());
  return result;
}

function parseCsv(csvText) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const header = splitCsvLine(lines[0]);
  const rows = [];

  for (let index = 1; index < lines.length; index += 1) {
    const values = splitCsvLine(lines[index]);
    const row = {};

    for (let columnIndex = 0; columnIndex < header.length; columnIndex += 1) {
      row[header[columnIndex]] = values[columnIndex] ?? '';
    }

    rows.push(row);
  }

  return rows;
}

function readCsv(relativePath) {
  return fs.readFileSync(relativePath, 'utf8');
}

function readExistingJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function parseOptionalScore(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function parseStadiums() {
  const rows = parseCsv(readCsv(stadiumsCsvPath));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    team: row.team,
    league: row.league,
    city: row.city,
    lat: Number.parseFloat(String(row.lat).replace(',', '.')),
    lon: Number.parseFloat(String(row.lon).replace(',', '.')),
  }));
}

function loadExperimentalLeaguePackStadiums() {
  if (!fs.existsSync(leaguePacksDir)) {
    return [];
  }

  const packs = fs.readdirSync(leaguePacksDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(leaguePacksDir, entry.name, 'stadiums.json'))
    .filter((filePath) => fs.existsSync(filePath));

  return packs.flatMap((filePath) => readExistingJson(filePath));
}

function mergeStadiums(stadiums) {
  const byId = new Map();

  for (const stadium of stadiums) {
    if (!stadium?.id) {
      continue;
    }

    byId.set(stadium.id, stadium);
  }

  return [...byId.values()];
}

function parseFixtures() {
  const rows = parseCsv(readCsv(fixturesCsvPath));

  return rows.map((row) => ({
    id: row.id,
    kickoff: row.kickoff,
    round: row.round || '',
    homeTeamId: row.homeTeamId,
    awayTeamId: row.awayTeamId,
    venueClubId: row.venueClubId,
    status: row.status,
    homeScore: parseOptionalScore(row.homeScore),
    awayScore: parseOptionalScore(row.awayScore),
    competitionId: row.competitionId || undefined,
    seasonId: row.seasonId || undefined,
  }));
}

function inferSeasonWindow(seasonId) {
  if (!seasonId || typeof seasonId !== 'string') {
    return null;
  }

  const match = seasonId.trim().match(/^(\d{4})-(\d{2}|\d{4})$/);
  if (!match) {
    return null;
  }

  const startYear = Number.parseInt(match[1], 10);
  const endToken = match[2];
  const endYear = endToken.length === 2
    ? Math.trunc(startYear / 100) * 100 + Number.parseInt(endToken, 10)
    : Number.parseInt(endToken, 10);

  const start = Date.parse(`${startYear}-07-01T00:00:00Z`);
  const endExclusive = Date.parse(`${endYear}-08-01T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(endExclusive) || start >= endExclusive) {
    return null;
  }

  return { start, endExclusive };
}

function fixtureMatchesSeasonWindow(fixture) {
  const window = inferSeasonWindow(fixture.seasonId);
  if (!window) {
    return true;
  }

  const kickoff = Date.parse(fixture.kickoff);
  if (Number.isNaN(kickoff)) {
    return true;
  }

  return kickoff >= window.start && kickoff < window.endExclusive;
}

function sanitizeFixtures(fixtures) {
  const sanitized = [];
  const dropped = [];

  for (const fixture of fixtures) {
    if (fixtureMatchesSeasonWindow(fixture)) {
      sanitized.push(fixture);
    } else {
      dropped.push(fixture);
    }
  }

  return { sanitized, dropped };
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeFileEnsured(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) {
    const existingContent = fs.readFileSync(filePath, 'utf8');
    if (existingContent === content) {
      return false;
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

function buildRemoteFixturesEnvelope(fixtures, previousEnvelope) {
  const checksum = crypto
    .createHash('sha256')
    .update(JSON.stringify(fixtures))
    .digest('hex');

  const previousChecksum = previousEnvelope?.metadata?.checksum;
  const previousGeneratedAt = previousEnvelope?.metadata?.generatedAt;
  const previousVersion = previousEnvelope?.metadata?.version;
  const previousSignature = previousEnvelope?.metadata?.signature ?? null;
  const generatedAt = previousChecksum === checksum && previousGeneratedAt
    ? previousGeneratedAt
    : new Date().toISOString();
  const version = previousChecksum === checksum && previousVersion
    ? previousVersion
    : generatedAt;

  return {
    metadata: {
      version,
      generatedAt,
      checksum,
      signature: previousSignature,
    },
    fixtures,
  };
}

const hasCanonicalCsvInputs = fs.existsSync(stadiumsCsvPath) && fs.existsSync(fixturesCsvPath);

const experimentalLeaguePackStadiums = loadExperimentalLeaguePackStadiums();
const stadiums = hasCanonicalCsvInputs
  ? mergeStadiums([...parseStadiums(), ...experimentalLeaguePackStadiums])
  : mergeStadiums([...readExistingJson(stadiumsJsonPath), ...experimentalLeaguePackStadiums]);
const parsedFixtures = hasCanonicalCsvInputs
  ? parseFixtures()
  : readExistingJson(fixturesJsonPath);
const { sanitized: fixtures, dropped: droppedFixtures } = sanitizeFixtures(parsedFixtures);
const previousRemoteFixturesEnvelope = fs.existsSync(remoteFixturesJsonPath)
  ? readExistingJson(remoteFixturesJsonPath)
  : null;
const remoteFixturesEnvelope = buildRemoteFixturesEnvelope(
  fixtures,
  previousRemoteFixturesEnvelope
);

writeFileEnsured(stadiumsJsonPath, stableJson(stadiums));
writeFileEnsured(fixturesJsonPath, stableJson(fixtures));
writeFileEnsured(remoteFixturesJsonPath, stableJson(remoteFixturesEnvelope));

if (hasCanonicalCsvInputs) {
  console.log('Source: app CSV files + league-pack sidecars');
} else {
  console.log('Source: checked-in web JSON aggregate + league-pack sidecars');
}
console.log(`Generated stadiums: ${stadiums.length}`);
console.log(`Generated fixtures: ${fixtures.length}`);
if (droppedFixtures.length > 0) {
  console.log(`Dropped structurally invalid fixtures: ${droppedFixtures.length}`);
}
console.log(`Updated ${path.relative(websiteRootDir, stadiumsJsonPath)}`);
console.log(`Updated ${path.relative(websiteRootDir, fixturesJsonPath)}`);
console.log(`Updated ${path.relative(websiteRootDir, remoteFixturesJsonPath)}`);
