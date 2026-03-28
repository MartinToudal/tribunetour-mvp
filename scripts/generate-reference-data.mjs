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
  }));
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function writeFileEnsured(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function buildRemoteFixturesEnvelope(fixtures) {
  const generatedAt = new Date().toISOString();
  const checksum = crypto
    .createHash('sha256')
    .update(JSON.stringify(fixtures))
    .digest('hex');

  return {
    metadata: {
      version: generatedAt,
      generatedAt,
      checksum,
      signature: null,
    },
    fixtures,
  };
}

const hasCanonicalCsvInputs = fs.existsSync(stadiumsCsvPath) && fs.existsSync(fixturesCsvPath);

const stadiums = hasCanonicalCsvInputs
  ? parseStadiums()
  : readExistingJson(stadiumsJsonPath);
const fixtures = hasCanonicalCsvInputs
  ? parseFixtures()
  : readExistingJson(fixturesJsonPath);
const remoteFixturesEnvelope = buildRemoteFixturesEnvelope(fixtures);

writeFileEnsured(stadiumsJsonPath, stableJson(stadiums));
writeFileEnsured(fixturesJsonPath, stableJson(fixtures));
writeFileEnsured(remoteFixturesJsonPath, stableJson(remoteFixturesEnvelope));

if (hasCanonicalCsvInputs) {
  console.log('Source: app CSV files');
} else {
  console.log('Source: checked-in web JSON fallback');
}
console.log(`Generated stadiums: ${stadiums.length}`);
console.log(`Generated fixtures: ${fixtures.length}`);
console.log(`Updated ${path.relative(websiteRootDir, stadiumsJsonPath)}`);
console.log(`Updated ${path.relative(websiteRootDir, fixturesJsonPath)}`);
console.log(`Updated ${path.relative(websiteRootDir, remoteFixturesJsonPath)}`);
