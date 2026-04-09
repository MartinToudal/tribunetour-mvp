export const legacyToCanonicalClubId: Record<string, string> = {
  aab: 'dk-aab',
  aaf: 'dk-aarhus-fremad',
  ab: 'dk-ab',
  ach: 'dk-ac-horsens',
  agf: 'dk-agf',
  b93: 'dk-b-93',
  bif: 'dk-brondby-if',
  bra: 'dk-brabrand-if',
  'brø': 'dk-bronshoj',
  efb: 'dk-esbjerg-fb',
  fa2: 'dk-fa-2000',
  faa: 'dk-fremad-amager',
  fcf: 'dk-fc-fredericia',
  fck: 'dk-fc-kobenhavn',
  fcm: 'dk-fc-midtjylland',
  fcn: 'dk-fc-nordsjaelland',
  fre: 'dk-frem',
  hbk: 'dk-hb-koge',
  hel: 'dk-fc-helsingor',
  hik: 'dk-hik',
  hil: 'dk-hillerod-fodbold',
  hob: 'dk-hobro-ik',
  hol: 'dk-holbaek-bi',
  'hør': 'dk-horsholm-usserod-ik',
  hvi: 'dk-hvidovre-if',
  ish: 'dk-ishoj-if',
  kol: 'dk-kolding-if',
  lyn: 'dk-lyngby-boldklub',
  lys: 'dk-if-lyseng',
  mid: 'dk-middelfart',
  'næs': 'dk-naesby-bk',
  nas: 'dk-naestved',
  nyk: 'dk-nykobing-fc',
  ob: 'dk-ob',
  odd: 'dk-odder-fodbold',
  ran: 'dk-randers-fc',
  ros: 'dk-fc-roskilde',
  sif: 'dk-silkeborg-if',
  sje: 'dk-sonderjyske',
  ski: 'dk-skive',
  sun: 'dk-sundby-bk',
  thi: 'dk-thisted-fc',
  van: 'dk-vanlose',
  vb: 'dk-vejle-boldklub',
  vej: 'dk-vejgaard-b',
  ven: 'dk-vendsyssel-ff',
  vff: 'dk-viborg-ff',
  vsk: 'dk-vsk-aarhus',
};

const canonicalToLegacyClubId = Object.fromEntries(
  Object.entries(legacyToCanonicalClubId).map(([legacyId, canonicalId]) => [canonicalId, legacyId])
) as Record<string, string>;

function normalizeIncomingClubId(clubId: string): string {
  try {
    return decodeURIComponent(clubId);
  } catch {
    return clubId;
  }
}

export function canonicalClubId(clubId: string): string {
  const normalizedClubId = normalizeIncomingClubId(clubId);
  return legacyToCanonicalClubId[normalizedClubId] ?? normalizedClubId;
}

export function allKnownClubIds(clubId: string): string[] {
  clubId = normalizeIncomingClubId(clubId);
  const canonicalId = canonicalClubId(clubId);
  const ids = [clubId];

  if (canonicalId !== clubId) {
    ids.push(canonicalId);
  }

  const legacyId = canonicalToLegacyClubId[canonicalId];
  if (legacyId && legacyId !== clubId) {
    ids.push(legacyId);
  }

  return Array.from(new Set(ids));
}

export function aliasMap<T>(source: Record<string, T>): Record<string, T> {
  const result: Record<string, T> = { ...source };

  for (const [id, value] of Object.entries(source)) {
    for (const alias of allKnownClubIds(id)) {
      if (!(alias in result)) {
        result[alias] = value;
      }
    }
  }

  return result;
}

export function isSameClubId(left: string, right: string): boolean {
  return canonicalClubId(left) === canonicalClubId(right);
}
