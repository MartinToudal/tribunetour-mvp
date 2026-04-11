import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const websiteRootDir = path.resolve(__dirname, '..');
const workspaceRootDir = path.resolve(websiteRootDir, '..');
const appDocsDir = path.join(workspaceRootDir, 'Tribunetour', 'Tribunetour_docs', 'docs');
const sourceDraftPath = path.join(appDocsDir, 'GERMAN_STADIUM_REFERENCE_DRAFT.md');
const outputDir = path.join(websiteRootDir, 'data', 'league-packs', 'germany_top_3');
const outputPath = path.join(outputDir, 'stadiums.json');

const leagueNamesByCode = {
  'de-bundesliga': 'Bundesliga',
  'de-2-bundesliga': '2. Bundesliga',
  'de-3-liga': '3. Liga',
};

function stripCodeTicks(value) {
  return value.trim().replace(/^`|`$/g, '');
}

function splitMarkdownRow(line) {
  const escapedPipePlaceholder = '[[PIPE]]';
  return line
    .replace(/\\\|/g, escapedPipePlaceholder)
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((value) => stripCodeTicks(value.replaceAll(escapedPipePlaceholder, '|')));
}

function parseStadiumRows(markdown) {
  const rows = [];

  for (const line of markdown.split(/\r?\n/)) {
    const trimmedLine = line.trim();
    if (!trimmedLine.startsWith('| `de-')) {
      continue;
    }

    const [
      id,
      team,
      shortCode,
      leagueCode,
      stadiumName,
      city,
      rawLat,
      rawLon,
    ] = splitMarkdownRow(trimmedLine);

    rows.push({
      id,
      name: stadiumName,
      team,
      league: leagueNamesByCode[leagueCode] ?? leagueCode,
      city,
      lat: Number.parseFloat(rawLat),
      lon: Number.parseFloat(rawLon),
      countryCode: 'de',
      leagueCode,
      leaguePack: 'germany_top_3',
      shortCode,
    });
  }

  return rows;
}

function validateStadiums(stadiums) {
  const errors = [];
  const ids = new Set();
  const shortCodesByLeague = new Set();

  for (const stadium of stadiums) {
    if (!stadium.id.startsWith('de-')) {
      errors.push(`Invalid German id: ${stadium.id}`);
    }
    if (ids.has(stadium.id)) {
      errors.push(`Duplicate id: ${stadium.id}`);
    }
    ids.add(stadium.id);

    const shortCodeKey = `${stadium.leagueCode}:${stadium.shortCode}`;
    if (shortCodesByLeague.has(shortCodeKey)) {
      errors.push(`Duplicate shortCode in ${stadium.leagueCode}: ${stadium.shortCode}`);
    }
    shortCodesByLeague.add(shortCodeKey);

    if (!stadium.name || !stadium.team || !stadium.city || !stadium.shortCode) {
      errors.push(`Missing required text field for ${stadium.id}`);
    }
    if (!Number.isFinite(stadium.lat) || !Number.isFinite(stadium.lon)) {
      errors.push(`Invalid coordinates for ${stadium.id}`);
    }
    if (stadium.countryCode !== 'de') {
      errors.push(`Invalid countryCode for ${stadium.id}: ${stadium.countryCode}`);
    }
    if (stadium.leaguePack !== 'germany_top_3') {
      errors.push(`Invalid leaguePack for ${stadium.id}: ${stadium.leaguePack}`);
    }
  }

  const expectedByLeague = {
    'de-bundesliga': 18,
    'de-2-bundesliga': 18,
    'de-3-liga': 20,
  };

  for (const [leagueCode, expectedCount] of Object.entries(expectedByLeague)) {
    const actualCount = stadiums.filter((stadium) => stadium.leagueCode === leagueCode).length;
    if (actualCount !== expectedCount) {
      errors.push(`Expected ${expectedCount} rows for ${leagueCode}, got ${actualCount}`);
    }
  }

  if (stadiums.length !== 56) {
    errors.push(`Expected 56 German stadium rows, got ${stadiums.length}`);
  }

  return errors;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const markdown = fs.readFileSync(sourceDraftPath, 'utf8');
const stadiums = parseStadiumRows(markdown);
const errors = validateStadiums(stadiums);

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, stableJson(stadiums), 'utf8');

console.log(`Generated ${stadiums.length} Germany stadium rows`);
console.log(`Updated ${path.relative(websiteRootDir, outputPath)}`);
