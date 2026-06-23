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
const leaguePackCsvSources = [
  { leaguePack: 'germany_top_3', fileName: 'germany_top_3.csv' },
  { leaguePack: 'england_top_4', fileName: 'england_top_4.csv' },
  { leaguePack: 'italy_top_3', fileName: 'italy_top_3.csv' },
  { leaguePack: 'spain_top_4', fileName: 'spain_top_4.csv' },
  { leaguePack: 'france_top_3', fileName: 'france_top_3.csv' },
  { leaguePack: 'portugal_top_3', fileName: 'portugal_top_3.csv' },
  { leaguePack: 'netherlands_top_3', fileName: 'netherlands_top_3.csv' },
  { leaguePack: 'belgium_top_3', fileName: 'belgium_top_3.csv' },
  { leaguePack: 'turkey_top_3', fileName: 'turkey_top_3.csv' },
];

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
    countryCode: row.country_code || undefined,
    leagueCode: row.league_code || undefined,
    leaguePack: row.league_pack || undefined,
    shortCode: row.short_code || undefined,
    competitionId: row.competition_id || undefined,
    seasonId: row.season_id || undefined,
    membershipStatus: row.membership_status || undefined,
    secondaryCompetitionIds: row.secondary_competition_ids || undefined,
  }));
}

function parseLeaguePackCsv(filePath) {
  const rows = parseCsv(readCsv(filePath));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    team: row.team,
    league: row.league,
    city: row.city,
    lat: Number.parseFloat(String(row.lat).replace(',', '.')),
    lon: Number.parseFloat(String(row.lon).replace(',', '.')),
    countryCode: row.country_code || undefined,
    leagueCode: row.league_code || undefined,
    leaguePack: row.league_pack || undefined,
    shortCode: row.short_code || undefined,
    competitionId: row.competition_id || undefined,
    seasonId: row.season_id || undefined,
    membershipStatus: row.membership_status || undefined,
    secondaryCompetitionIds: row.secondary_competition_ids || undefined,
  }));
}

function loadCanonicalLeaguePackStadiums() {
  return leaguePackCsvSources.flatMap(({ fileName }) => {
    const filePath = path.join(appDir, fileName);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    return parseLeaguePackCsv(filePath);
  });
}

function loadExperimentalLeaguePackStadiumsFromSidecars() {
  if (!fs.existsSync(leaguePacksDir)) {
    return [];
  }

  return fs.readdirSync(leaguePacksDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(leaguePacksDir, entry.name, 'stadiums.json'))
    .filter((filePath) => fs.existsSync(filePath))
    .flatMap((filePath) => readExistingJson(filePath));
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

function writeLeaguePackSidecars(stadiums) {
  const grouped = new Map();

  for (const stadium of stadiums) {
    const leaguePack = stadium.leaguePack;
    if (!leaguePack || leaguePack === 'core_denmark') {
      continue;
    }

    if (!grouped.has(leaguePack)) {
      grouped.set(leaguePack, []);
    }
    grouped.get(leaguePack).push(stadium);
  }

  let updatedCount = 0;

  for (const [leaguePack, leaguePackStadiums] of grouped.entries()) {
    const filePath = path.join(leaguePacksDir, leaguePack, 'stadiums.json');
    if (writeFileEnsured(filePath, stableJson(leaguePackStadiums))) {
      updatedCount += 1;
    }
  }

  return updatedCount;
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

const experimentalLeaguePackStadiums = hasCanonicalCsvInputs
  ? loadCanonicalLeaguePackStadiums()
  : loadExperimentalLeaguePackStadiumsFromSidecars();
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
const updatedLeaguePackSidecars = hasCanonicalCsvInputs
  ? writeLeaguePackSidecars(stadiums)
  : 0;

if (hasCanonicalCsvInputs) {
  console.log('Source: app CSV files');
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
if (hasCanonicalCsvInputs) {
  console.log(`Updated league-pack sidecars: ${updatedLeaguePackSidecars}`);
}
