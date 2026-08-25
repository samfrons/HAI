/**
 * Deterministic screening of user input for identifiable personal data.
 *
 * This runs on every message before anything reaches the model. It is
 * regex-and-heuristics only: no network call, no LLM, no state. Three
 * properties matter more than coverage:
 *
 * 1. It never returns, stores, or logs the matched text. Findings carry a
 *    masked snippet, because a screening layer that echoes what it caught has
 *    just moved the exposure rather than prevented it.
 * 2. It is biased hard toward precision. A humanitarian assistant that refuses
 *    "15 litres per person per day" because it looks numeric is worse than
 *    useless — practitioners stop trusting the refusal and route around it.
 *    Every detector below therefore requires a positive personal-data signal
 *    (a label, a country-code prefix, a structured identifier shape, a
 *    person-record field), never bare digits.
 * 3. It is fast enough to sit in the request path: linear scans over a capped
 *    input, no backtracking-prone patterns.
 *
 * What it deliberately does not attempt: free-text names on their own, and
 * narrative incident descriptions where age + village + date re-identify
 * someone in a small community. Those need semantic judgement — see
 * `llm-screen.ts` for the opt-in second pass.
 */

export type PiiFindingType =
  | 'phone'
  | 'email'
  | 'identifier'
  | 'coordinates'
  | 'date-of-birth'
  | 'bulk-list';

export interface PiiFinding {
  type: PiiFindingType;
  /** Human-readable name for the pattern, used in the refusal message. */
  label: string;
  /**
   * Masked excerpt. Structure is preserved so the reader can locate what was
   * flagged; the value is not recoverable from it. Never the raw match.
   */
  snippet: string;
  /** Why this pattern is treated as personal data, in the user's terms. */
  reason: string;
  /**
   * The IASC Operational Guidance on Data Responsibility principle engaged,
   * named exactly as that guidance names it.
   */
  principle: string;
  /** Concrete rephrasing that keeps the underlying request answerable. */
  remedy: string;
}

export interface PiiScreenResult {
  flagged: boolean;
  findings: PiiFinding[];
}

/**
 * Inputs longer than this are truncated before screening. A chat message this
 * long is already a paste rather than a question, and the bulk-list detector
 * will have fired well before the cap.
 */
const MAX_SCREENED_CHARS = 20_000;
const MAX_SCREENED_LINES = 500;
const MAX_FINDINGS = 8;

/* ------------------------------------------------------------------ *
 * Masking
 * ------------------------------------------------------------------ */

/**
 * Replace the interior of a value with bullets, keeping the first two and last
 * alphanumeric characters and all punctuation. `+254712345678` becomes
 * `+25•••••••••8` — recognisable as the thing you just pasted, useless as an
 * identifier.
 */
export function maskSnippet(value: string, maxLength = 44): string {
  const trimmed = value.trim();
  const clipped =
    trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;

  const positions: number[] = [];
  for (let i = 0; i < clipped.length; i += 1) {
    if (/[A-Za-z0-9]/.test(clipped[i])) positions.push(i);
  }

  const keep = new Set<number>();
  for (const index of positions.slice(0, 2)) keep.add(index);
  // The trailing character only survives on values long enough that three
  // revealed characters out of six or more give nothing away.
  if (positions.length > 5) keep.add(positions[positions.length - 1]);

  return clipped
    .split('')
    .map((char, index) =>
      /[A-Za-z0-9]/.test(char) && !keep.has(index) ? '•' : char,
    )
    .join('');
}

/* ------------------------------------------------------------------ *
 * Shared guards
 * ------------------------------------------------------------------ */

/**
 * Units and magnitudes. A number sitting next to one of these is a measurement,
 * not a contact detail. Kept narrow on purpose: it vetoes the weakest phone
 * path, and person nouns are excluded because "reach the household on 07…" is
 * exactly the case that path exists to catch.
 */
const MEASURE_UNITS =
  /\b(?:litres?|liters?|l\/p\/d|lpd|kg|kcal|grams?|grammes?|mg|ml|m2|m²|m3|m³|sq\s?m|met(?:re|er)s?|km|hectares?|percent|per\s?cent|per\s+person|per\s+day|per\s+capita|usd|eur|chf|gbp|million|billion|thousand)\b/i;

/**
 * The wider vocabulary of humanitarian counting. Used where the risk runs the
 * other way — an unlabelled identifier sitting in a sentence about caseloads is
 * far more likely to be a figure than a person's file number.
 */
const MEASURE_CONTEXT =
  /\b(?:litres?|liters?|kg|kcal|km|percent|per\s?cent|per\s+person|per\s+day|households?|individuals?|people|persons?|beneficiaries|caseloads?|population|children|women|men|refugees?|idps?|usd|eur|million|billion|thousand|ratio|coverage|rates?|mortality|morbidity|prevalence|incidence|indicators?|standards?|targets?|thresholds?|minimum|maximum|admissions?|consultations?|latrines?|shelters?|tents?|rations?)\b/i;

function windowAround(input: string, start: number, end: number, radius = 32) {
  return input.slice(Math.max(0, start - radius), Math.min(input.length, end + radius));
}

function digitCount(value: string): number {
  return value.replace(/\D/g, '').length;
}

/* ------------------------------------------------------------------ *
 * Detector: phone numbers
 * ------------------------------------------------------------------ */

/**
 * A label immediately preceding a digit run. Anchored to the end of the
 * preceding window, so "mobile: 0712…" matches and "mobile clinics served 4500
 * people" does not.
 */
const PHONE_LABEL_BEFORE =
  /\b(?:phone|phone\s*(?:no|number)|tel|telephone|mobile|cell|cellphone|handphone|whatsapp|wa|viber|msisdn|sms|contact(?:\s*(?:no|number|details))?|t[ée]l[ée]phone|portable|tel[eé]fono|celular|n[uú]mero)\b[\s:=.#\-–—]*$/i;

/** International form: a country-code prefix is an unambiguous contact signal. */
const PHONE_INTERNATIONAL = /\+\d[\d\s().\-–]{6,18}\d/g;

/** Any other separator-tolerant digit run; qualified by label or leading zero. */
const PHONE_BARE = /(?<![\d.,])\d[\d\s().\-–]{5,16}\d(?![\d.,])/g;

function detectPhones(input: string, push: (finding: PiiFinding) => void): void {
  const seen = new Set<string>();

  const record = (match: string) => {
    const key = match.replace(/\D/g, '');
    if (seen.has(key)) return;
    seen.add(key);
    push({
      type: 'phone',
      label: 'Telephone number',
      snippet: maskSnippet(match),
      reason:
        'A contact number reaches one specific person, and in most registration systems it is the field that links every other record about them.',
      principle: 'personal data protection',
      remedy:
        'Drop the number. If the question is about reaching people, ask about the referral or communication-with-communities pathway instead of naming a line.',
    });
  };

  for (const match of input.matchAll(PHONE_INTERNATIONAL)) {
    const value = match[0];
    const digits = digitCount(value);
    if (digits < 8 || digits > 15) continue;
    record(value);
  }

  for (const match of input.matchAll(PHONE_BARE)) {
    const value = match[0];
    const start = match.index ?? 0;
    const digits = digitCount(value);
    if (digits > 15) continue;

    const before = input.slice(Math.max(0, start - 34), start);
    const labelled = PHONE_LABEL_BEFORE.test(before);

    if (labelled) {
      if (digits < 7) continue;
      record(value);
      continue;
    }

    // Unlabelled. A leading zero on a 10-to-13 digit run is a national trunk
    // prefix; statistics do not carry leading zeros, and comma-grouped or
    // decimal figures are excluded by the pattern's own boundaries. Still
    // vetoed if the surrounding words say measurement.
    if (!/^0\d/.test(value.trim())) continue;
    if (digits < 10 || digits > 13) continue;
    if (MEASURE_UNITS.test(windowAround(input, start, start + value.length))) continue;
    record(value);
  }
}

/* ------------------------------------------------------------------ *
 * Detector: email addresses
 * ------------------------------------------------------------------ */

const EMAIL = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,24}\b/g;

function detectEmails(input: string, push: (finding: PiiFinding) => void): void {
  const seen = new Set<string>();
  for (const match of input.matchAll(EMAIL)) {
    const value = match[0];
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    push({
      type: 'email',
      label: 'Email address',
      snippet: maskSnippet(value),
      reason:
        'An email address is a direct identifier on its own, and it is routinely the join key between a case file and everything else held about a person.',
      principle: 'personal data protection',
      remedy:
        'Remove it. Describe the role ("the camp protection focal point") rather than the mailbox.',
    });
  }
}

/* ------------------------------------------------------------------ *
 * Detector: case, registration and national identifiers
 * ------------------------------------------------------------------ */

/**
 * Subject words that make a following code a *person's* identifier. Deliberately
 * excludes plurals: "individuals 45000 reached" is a caseload, "individual ID
 * 45000" is a person.
 */
const ID_SUBJECT =
  'case|file|beneficiary|household|individual|client|patient|refugee|applicant|claimant|survivor|registration|enrolment|enrollment|ration\\s*card|token|progres|prog\\s*res|unhcr|national\\s*id(?:entity)?(?:\\s*card)?|passport|id\\s*card|nin|ssn|biometric|iris';

const ID_MARKER = 'no\\.?|number|num|nr|#|id|code|ref(?:erence)?|serial';

/**
 * Subjects that already carry their own identifier marker — "national ID
 * 19870512345" needs no second one, and requiring a structured value would
 * throw away the plain numeric national IDs that most registries issue.
 */
const SELF_MARKING_SUBJECT = /\b(?:id|identity|card|passport|nin|ssn|progres|token|biometric|iris)\b/i;

const ID_PATTERN = new RegExp(
  `\\b(${ID_SUBJECT})\\b\\s*(${ID_MARKER})?\\s*[:#=]?\\s*([A-Za-z0-9][A-Za-z0-9/\\-]{2,23})\\b`,
  'gi',
);

/**
 * UNHCR ProGres individual numbers have a fixed shape (`806-13C01234`) that
 * nothing else in humanitarian text collides with, so it is worth matching
 * unlabelled — pasted registration extracts rarely carry the column header.
 */
const PROGRES_ID = /\b\d{3}-\d{2}[A-Za-z]\d{4,6}\b/g;

function detectIdentifiers(input: string, push: (finding: PiiFinding) => void): void {
  const seen = new Set<string>();

  const record = (value: string, label: string) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    push({
      type: 'identifier',
      label,
      snippet: maskSnippet(value),
      reason:
        'A case or registration number is a pseudonym, not anonymity: anyone holding the registration database can resolve it back to a named person and their full history.',
      principle: 'confidentiality',
      remedy:
        'Strip the identifier and ask the question at the level you actually need — "how should a case of this type be referred", not "what should happen to this case".',
    });
  };

  for (const match of input.matchAll(PROGRES_ID)) {
    record(match[0], 'Registration identifier (ProGres-style)');
  }

  for (const match of input.matchAll(ID_PATTERN)) {
    const [, subject, rawMarker, value] = match;
    if (!value) continue;
    if (!/\d/.test(value)) continue;

    const marker = rawMarker || (SELF_MARKING_SUBJECT.test(subject) ? subject : undefined);

    if (marker) {
      // "case #4512", "beneficiary ID 44219" — the marker is the signal.
      if (digitCount(value) < 2) continue;
    } else {
      // No marker, so the value itself has to look like a code rather than a
      // count: letters mixed with digits, or an internal separator.
      const structured =
        (/[A-Za-z]/.test(value) && /\d/.test(value) && value.length >= 4) ||
        /[/\-]/.test(value);
      if (!structured) continue;
    }

    const start = match.index ?? 0;
    if (MEASURE_CONTEXT.test(windowAround(input, start, start + match[0].length, 16))) {
      // e.g. "refugee ID card 12" sitting inside a sentence about caseloads —
      // rare, and a missed identifier is recoverable where a blocked Sphere
      // question is not.
      if (!marker) continue;
    }

    record(value, 'Case or registration identifier');
  }
}

/* ------------------------------------------------------------------ *
 * Detector: GPS coordinates
 * ------------------------------------------------------------------ */

/**
 * Four decimal places is roughly eleven metres. Humanitarian statistics do not
 * carry that precision in a comma-separated pair; a location pinned to a
 * household does.
 */
const COORD_DECIMAL_PAIR =
  /(-?\d{1,3}\.\d{4,})\s*[,;/]\s*(-?\d{1,3}\.\d{4,})/g;

const COORD_LABELLED =
  /\b(?:gps|lat(?:itude)?|lon(?:gitude)?|lng|coord(?:inate)?s?|geo(?:location|point|_?coordinates)?|what3words)\b\s*[:=]?\s*(-?\d{1,3}\.\d+)\s*[,;/]?\s*(-?\d{1,3}\.\d+)?/gi;

const COORD_DMS =
  /\b\d{1,3}\s*°\s*\d{1,2}\s*['′’]\s*(?:[\d.]+\s*["″”]\s*)?[NSEW]\b/g;

function inLatLonRange(lat: number, lon: number): boolean {
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function detectCoordinates(input: string, push: (finding: PiiFinding) => void): void {
  const seen = new Set<string>();

  const record = (value: string) => {
    const key = value.replace(/\s+/g, '');
    if (seen.has(key)) return;
    seen.add(key);
    push({
      type: 'coordinates',
      label: 'Precise geographic coordinates',
      snippet: maskSnippet(value),
      reason:
        'A point location at this precision identifies a dwelling or a distribution point, not an area — and in an insecure context it identifies who is standing there.',
      principle: 'do no harm',
      remedy:
        'Use the administrative level the answer actually needs — settlement, block, or admin-2 — instead of a pinned point.',
    });
  };

  for (const match of input.matchAll(COORD_DECIMAL_PAIR)) {
    if (!inLatLonRange(Number(match[1]), Number(match[2]))) continue;
    record(match[0]);
  }

  for (const match of input.matchAll(COORD_LABELLED)) {
    if (match[2] !== undefined && !inLatLonRange(Number(match[1]), Number(match[2]))) {
      continue;
    }
    record(match[0]);
  }

  for (const match of input.matchAll(COORD_DMS)) {
    record(match[0]);
  }
}

/* ------------------------------------------------------------------ *
 * Detector: dates of birth
 * ------------------------------------------------------------------ */

const DATE_VALUE =
  '(?:\\d{1,4}[/.\\-]\\d{1,2}[/.\\-]\\d{2,4}|\\d{1,2}\\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s+\\d{4}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?\\s+\\d{1,2},?\\s+\\d{4})';

/**
 * The `\b` sits inside the word branch rather than after the whole group: an
 * abbreviation ending in a full stop ("D.O.B.") has no word boundary after it,
 * and an outer `\b` silently drops the most common way people write it.
 */
const DOB_PATTERN = new RegExp(
  '\\b(?:d\\.?\\s?o\\.?\\s?b\\.?|(?:date\\s+of\\s+birth|birth\\s*date|birthday|' +
    'date\\s+de\\s+naissance|fecha\\s+de\\s+nacimiento|born(?:\\s+on)?)\\b)' +
    `\\s*[:=\\-–]?\\s*(${DATE_VALUE})`,
  'gi',
);

/** Two consecutive capitalised words — the shape of a personal name. */
const NAME_PAIR = /\b([A-Z][a-z'’\-]{1,20})\s+([A-Z][a-z'’\-]{1,20})\b/g;

function detectDatesOfBirth(input: string, push: (finding: PiiFinding) => void): void {
  const seen = new Set<string>();

  for (const match of input.matchAll(DOB_PATTERN)) {
    const value = match[0];
    const key = value.toLowerCase().replace(/\s+/g, '');
    if (seen.has(key)) continue;
    seen.add(key);

    const start = match.index ?? 0;
    const nearby = input.slice(Math.max(0, start - 70), start);
    const namedNearby = findNameLikePair(nearby) !== undefined;

    push({
      type: 'date-of-birth',
      label: namedNearby ? 'Date of birth alongside a name' : 'Date of birth',
      snippet: maskSnippet(value),
      reason: namedNearby
        ? 'A name with a date of birth attached is a direct identifier, and it is the pair that registration and protection systems use to match records across agencies.'
        : 'A date of birth is a strong quasi-identifier: combined with a location and a rough age it re-identifies a specific person in a small community.',
      principle: 'defined purpose, necessity and proportionality',
      remedy:
        'Use an age band — "a 34-year-old woman", or the cohort the standard applies to — rather than a birth date.',
    });
  }
}

/* ------------------------------------------------------------------ *
 * Detector: bulk person lists (the "pasted a case list" near-miss)
 * ------------------------------------------------------------------ */

/**
 * Capitalised tokens that appear in name position but are vocabulary, agencies,
 * or places. Without this list, a table of country figures reads as a roster of
 * people: "Sierra Leone, 120000, 45" has exactly the shape of "Amina Hassan,
 * 34, F".
 */
const NON_NAME_TOKENS = new Set(
  (
    // Standards, sectors, and report furniture
    'sphere handbook standard standards minimum maximum core humanitarian quality accountability ' +
    'guidance guideline guidelines operational data responsibility working group cluster sector ' +
    'water sanitation hygiene wash shelter settlement health nutrition food security livelihoods ' +
    'protection education logistics camp coordination management site total population household ' +
    'households individual individuals people persons women men children child adults boys girls ' +
    'under over reference period source table annex chapter section figure note notes key actions ' +
    'action response emergency rapid needs assessment report situation update flash appeal plan ' +
    'overview indicator indicators target actual baseline coverage rate ratio litres liters per ' +
    'day person male female yes no name age sex gender location status type number date phase ' +
    'level tier round wave supply supplies distribution registration general national regional ' +
    'district province state county governorate subdistrict village town city region area zone ' +
    'block sector site partner partners agency agencies donor donors funding budget ' +
    // Organisations
    'united nations world programme program fund organization organisation international committee ' +
    'federation red cross crescent save norwegian danish refugee council doctors without borders ' +
    'unhcr unicef wfp who ocha iom fao undp unfpa unrwa icrc ifrc msf nrc drc irc oxfam care ' +
    'mercy corps concern acted solidarites tearfund caritas islamic relief ' +
    // Calendar
    'january february march april may june july august september october november december ' +
    'monday tuesday wednesday thursday friday saturday sunday ' +
    // Places and operational geographies that occur as capitalised pairs
    'north south east west central northern southern eastern western middle upper lower new old ' +
    'republic democratic congo sierra leone burkina faso sri lanka costa rica puerto rico el ' +
    'salvador papua guinea bissau ivory coast cote ivoire timor leste cabo verde cape saudi arabia ' +
    'arab emirates bosnia herzegovina south sudan myanmar bangladesh cox bazar dadaab kakuma ' +
    'kutupalong zaatari azraq goma juba maiduguri bidibidi rohingya sahel horn africa asia europe ' +
    'americas pacific lake chad basin tigray amhara afar oromia somali somaliland puntland darfur ' +
    'kordofan nile blue white idlib aleppo damascus homs gaza strip bank jerusalem kabul herat ' +
    'kandahar sanaa aden taiz hodeidah port prince haiti venezuela colombia ecuador peru ukraine ' +
    'kharkiv donetsk luhansk mariupol kyiv lviv moldova poland romania hungary slovakia turkey ' +
    'syria lebanon jordan iraq iran yemen afghanistan pakistan somalia ethiopia kenya uganda ' +
    'tanzania rwanda burundi nigeria niger mali chad cameroon mozambique malawi zambia zimbabwe ' +
    'madagascar bahr ghazal equatoria unity jonglei warrap lakes'
  ).split(/\s+/),
);

function findNameLikePair(line: string): string | undefined {
  NAME_PAIR.lastIndex = 0;
  for (const match of line.matchAll(NAME_PAIR)) {
    const first = match[1].toLowerCase();
    const second = match[2].toLowerCase();
    if (NON_NAME_TOKENS.has(first) || NON_NAME_TOKENS.has(second)) continue;
    return match[0];
  }
  return undefined;
}

/** Commas, semicolons, pipes and tabs that separate fields rather than digits. */
function fieldDelimiterCount(line: string): number {
  let count = 0;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char !== ',' && char !== ';' && char !== '|' && char !== '\t') continue;
    // A comma inside 120,000 is grouping, not a field break.
    if (char === ',' && /\d/.test(line[i - 1] ?? '') && /\d/.test(line[i + 1] ?? '')) {
      continue;
    }
    count += 1;
  }
  return count;
}

const SEX_FIELD = /^(?:m|f|male|female|boy|girl|hombre|mujer)$/i;

/**
 * A field that only makes sense about a person: a bare age, a sex marker, or a
 * date. A percentage or a population count is not one, which is what separates
 * a roster from a country table.
 */
function hasPersonField(line: string): boolean {
  const fields = line.split(/[,;|\t]/).map((field) => field.trim());
  for (const field of fields) {
    if (SEX_FIELD.test(field)) return true;
    if (/^\d{1,3}$/.test(field)) {
      const age = Number(field);
      if (age >= 1 && age <= 110) return true;
    }
    if (/^\d{1,2}\s*(?:yrs?|years?(?:\s+old)?|y\/o|ans|años)$/i.test(field)) return true;
    if (/^\d{1,4}[/.\-]\d{1,2}[/.\-]\d{2,4}$/.test(field)) return true;
  }
  return false;
}

function detectBulkList(input: string, push: (finding: PiiFinding) => void): void {
  const lines = input.split(/\r?\n/).slice(0, MAX_SCREENED_LINES);
  let matches = 0;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length < 6 || line.length > 200) continue;
    if (!/\d/.test(line)) continue;
    if (!findNameLikePair(line)) continue;
    // Two independent guards, both required: the line has to be shaped like a
    // record (three or more fields) *and* carry a field that is only
    // meaningful about a person.
    if (fieldDelimiterCount(line) < 2) continue;
    if (!hasPersonField(line)) continue;
    matches += 1;
  }

  if (matches < 3) return;

  push({
    type: 'bulk-list',
    label: 'Bulk list of person records',
    snippet: `${matches} lines shaped as "name, age/sex, …"`,
    reason:
      'A pasted roster is the near-miss that does the most damage, because it does not feel like a data transfer in the moment — it feels like saving an hour on a report. It is a personal data breach from the moment it is pasted, whatever happens to the output.',
    principle: 'personal data protection',
    remedy:
      'Aggregate before you paste: counts by age band, sex, and location carry the analysis without carrying the people. If you need per-row work, do it in the system that already holds the data under its own access controls.',
  });
}

/* ------------------------------------------------------------------ *
 * Entry point
 * ------------------------------------------------------------------ */

const DETECTORS = [
  detectPhones,
  detectEmails,
  detectIdentifiers,
  detectCoordinates,
  detectDatesOfBirth,
  detectBulkList,
] as const;

/**
 * Screen a block of user text. Returns masked findings only — the caller can
 * render, count, and reason about them without ever handling the raw value.
 */
export function screenForPii(input: string): PiiScreenResult {
  if (!input || typeof input !== 'string') return { flagged: false, findings: [] };

  const text = input.length > MAX_SCREENED_CHARS ? input.slice(0, MAX_SCREENED_CHARS) : input;
  const findings: PiiFinding[] = [];
  const seen = new Set<string>();

  const push = (finding: PiiFinding) => {
    const key = `${finding.type}:${finding.snippet}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (findings.length >= MAX_FINDINGS) return;
    findings.push(finding);
  };

  for (const detect of DETECTORS) detect(text, push);

  return { flagged: findings.length > 0, findings };
}
