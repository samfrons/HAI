/**
 * Turning whatever a tool returned into evidence the rest of the engine can
 * use, without the engine knowing which tools exist.
 *
 * This file deliberately does not import from `@/lib/tools`. HAI's tool
 * registry is under active extension — live hazard feeds, country context —
 * and a deliverable engine that switches on tool name would need editing every
 * time one is added, which is exactly the coupling that leaves a new data
 * source wired up but invisible in the product. So the shapes are probed
 * structurally: find the arrays of records, name each record from whichever
 * labelling fields it happens to carry, and serialise the rest.
 *
 * The other half of the job is the `situation.py` pattern this was ported
 * from: a source that is down, unconfigured, or simply has no coverage for the
 * country asked about must degrade the section it feeds and nothing else. Every
 * such failure is caught here, recorded, and surfaced in the finished
 * document's caveats — never thrown, and never silently dropped.
 */

/** One retrieved fact, carrying the label a drafted claim must cite it by. */
export interface EvidenceItem {
  /** Stable within a run: `e1`, `e2`… The draft step cites these. */
  id: string;
  /** Registry key of the tool that produced it. */
  tool: string;
  /** Human source label — "Sphere Handbook · WASH 2.1", "HDX HAPI · funding". */
  label: string;
  /** The content itself, clipped. */
  text: string;
}

/** A source that failed or reported no coverage, for the caveats section. */
export interface SourceError {
  source: string;
  message: string;
}

/**
 * Per-item and per-result clipping.
 *
 * These numbers are a token budget, not a display choice. Every piece of
 * evidence a section gathers is re-sent in that section's draft call and again
 * in its verify call, and the hosted deployment runs against Groq's free tier
 * at 8,000 tokens per minute (see `docs/DEPLOY.md`). Eight items of 420
 * characters is roughly 850 tokens of evidence per section, which leaves room
 * for the prompt and the output inside a single minute's budget. Raising either
 * number without raising the pacer's ceiling in `pacer.ts` is how a run starts
 * stalling on 429s two sections in.
 */
const MAX_ITEM_CHARS = 420;
const MAX_ITEMS_PER_RESULT = 8;

/** Fields that, when present, name a record well enough to cite it by. */
const LABEL_FIELDS = [
  'source',
  'title',
  'name',
  'label',
  'indicator',
  'dataset',
  'event_type',
  'organization',
  'organisation',
] as const;

/**
 * Fields that qualify a label — a section reference, a period, a date, or the
 * particular thing a record is about.
 *
 * Both cases of each name, because the tools do not agree and should not have
 * to. The HDX-backed tools return snake_case straight off the wire
 * (`reference_period`); the live-source connectors in `tools/live-sources/*`
 * map into camelCase TypeScript interfaces (`alertLevel`, `eventType`). Without
 * the camelCase forms every GDACS alert and USGS event labels as the bare
 * source name, so a brief citing three different floods cites all of them as
 * "GDACS" and the reader cannot tell which.
 */
const QUALIFIER_FIELDS = [
  'section',
  'reference_period',
  'period',
  'date',
  'year',
  // Hazard type before severity: it is the discriminator a reader needs to tell
  // two GDACS records apart ("GDACS · Flood" against "GDACS · Tropical
  // Cyclone"), while the severity is a property of the event and travels in the
  // record body anyway.
  'event_type',
  'eventType',
  'alert_level',
  'alertLevel',
  'place',
  'page',
  // Last resort: a plan or indicator name, for records whose only other
  // labelling field is the publisher (OCHA HPC's response plans).
  'name',
] as const;

/**
 * Fields whose presence means "this did not work" rather than "here is a
 * result". `notice` is HAI's own convention for an empty retrieval (see
 * `search_standards`); `available: false` is `humanitarian_data`'s; `error` is
 * everyone's. Checked structurally so a tool added later gets the same
 * treatment by following the same convention.
 */
function extractFailures(tool: string, value: Record<string, unknown>): SourceError[] {
  const found: SourceError[] = [];

  if (typeof value.error === 'string' && value.error) {
    found.push({ source: tool, message: clip(value.error, 260) });
  }
  if (value.available === false) {
    const reason = typeof value.reason === 'string' ? value.reason : undefined;
    const detail = typeof value.detail === 'string' ? value.detail : undefined;
    found.push({ source: tool, message: clip(detail ?? reason ?? 'no data available', 260) });
  }
  if (typeof value.notice === 'string' && value.notice) {
    found.push({ source: tool, message: clip(value.notice, 260) });
  }

  // A plural `errors` list is the `situation.py` convention this engine was
  // ported from, and `hazards_context` follows it: each entry is one upstream
  // source that degraded while the others succeeded. Reported per source rather
  // than collapsed, because "GDACS is down" and "World Bank has no 2024 figure"
  // are different facts to a reader deciding whether to trust the section.
  if (Array.isArray(value.errors)) {
    for (const entry of value.errors) {
      if (typeof entry === 'string' && entry.trim()) {
        // Entries are conventionally "source: what went wrong".
        const split = /^([a-z0-9_ -]{2,24}):\s*(.+)$/i.exec(entry.trim());
        found.push(
          split
            ? { source: `${tool} · ${split[1]}`, message: clip(split[2], 260) }
            : { source: tool, message: clip(entry, 260) },
        );
      } else if (isRecord(entry)) {
        const source = stringField(entry, LABEL_FIELDS)?.value ?? tool;
        const message =
          stringField(entry, ['message', 'error', 'detail', 'reason'])?.value ?? 'failed';
        found.push({ source: `${tool} · ${source}`, message: clip(message, 260) });
      }
    }
  }

  return found;
}

export function clip(text: string, max = MAX_ITEM_CHARS): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : cut.length)}…`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The first of `keys` this record actually carries a usable value for, with the
 * key it came from.
 *
 * Returning the key matters: the caller excludes it from the record's body so
 * the label is not repeated inside it. An earlier version guessed by re-scanning
 * for the first key merely `!== undefined`, which picks a different field
 * whenever an earlier one is present but null — common in the live-source
 * shapes, where `title` and `country` are `string | null`.
 */
function stringField(
  record: Record<string, unknown>,
  keys: readonly string[],
): { key: string; value: string } | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return { key, value: value.trim() };
    if (typeof value === 'number') return { key, value: String(value) };
  }
  return undefined;
}

/** Everything about a record except the parts already used as its label. */
function bodyOf(record: Record<string, unknown>, usedKeys: Set<string>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(record)) {
    if (usedKeys.has(key)) continue;
    if (value === null || value === undefined || value === '') continue;
    if (typeof value === 'object') {
      parts.push(`${key}: ${clip(JSON.stringify(value), 160)}`);
    } else {
      parts.push(`${key}: ${String(value)}`);
    }
  }
  return parts.join('; ');
}

/**
 * A record's citable label, built from whatever naming fields it carries.
 * `text`-bearing records (retrieved passages) label as "source · section";
 * figure records label as "source · indicator (period)".
 */
function labelOf(record: Record<string, unknown>, tool: string, used: Set<string>): string {
  const base = stringField(record, LABEL_FIELDS);
  if (base) used.add(base.key);

  const qualifier = stringField(record, QUALIFIER_FIELDS);
  // A field can appear in both lists (`name`), in which case it has already
  // been spent on the head and must not be repeated as its own qualifier.
  if (qualifier && qualifier.key !== base?.key) {
    used.add(qualifier.key);
    return `${base?.value ?? tool} · ${qualifier.value}`;
  }

  return base?.value ?? tool;
}

/** The main body text of a record, if it has one. */
function textOf(record: Record<string, unknown>, used: Set<string>): string | undefined {
  for (const key of ['text', 'excerpt', 'summary', 'body', 'description'] as const) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      used.add(key);
      return value;
    }
  }
  return undefined;
}

/**
 * Fields every tool result carries to describe the request rather than the
 * answer. A record made only of these is an empty envelope.
 */
const ENVELOPE_FIELDS = new Set([
  'scope',
  'generatedAt',
  'generated_at',
  'query',
  'source',
  'dataset',
  'type',
  'country',
  'country_iso3',
  'countryIso3',
  'available',
  'errors',
]);

function hasSubstance(record: Record<string, unknown>): boolean {
  return Object.entries(record).some(
    ([key, value]) =>
      !ENVELOPE_FIELDS.has(key) && value !== null && value !== undefined && value !== '',
  );
}

export interface Harvest {
  items: EvidenceItem[];
  errors: SourceError[];
}

/**
 * Read one tool result into evidence items and source errors.
 *
 * `nextId` is passed in rather than held in module state so a run's ids are
 * sequential across sections and two concurrent runs cannot collide.
 */
export function harvest(tool: string, output: unknown, nextId: () => string): Harvest {
  const items: EvidenceItem[] = [];
  const errors: SourceError[] = [];

  if (!isRecord(output)) {
    // A scalar or array at the top level: keep it whole rather than guessing.
    if (output !== undefined && output !== null) {
      items.push({ id: nextId(), tool, label: tool, text: clip(JSON.stringify(output)) });
    }
    return { items, errors };
  }

  errors.push(...extractFailures(tool, output));

  // Arrays of records are the payload in every tool shape HAI has: `chunks`
  // for passages, `updates` for situation reports, `figures` for indicators,
  // `gdacsAlerts` and `countryContext` for hazards. `errors` is excluded — it
  // was just read as degradation above, and evidence a section cites must never
  // be a description of a source that failed.
  const arrays = Object.entries(output).filter(
    (entry): entry is [string, unknown[]] =>
      entry[0] !== 'errors' && Array.isArray(entry[1]) && entry[1].length > 0,
  );

  for (const [key, array] of arrays) {
    for (const entry of array.slice(0, MAX_ITEMS_PER_RESULT)) {
      if (!isRecord(entry)) {
        items.push({ id: nextId(), tool, label: `${tool} · ${key}`, text: clip(String(entry)) });
        continue;
      }
      const used = new Set<string>();
      const label = labelOf(entry, tool, used);
      const body = textOf(entry, used);
      const rest = bodyOf(entry, used);
      const text = body ? clip(rest ? `${body} (${rest})` : body) : clip(rest);
      if (text) items.push({ id: nextId(), tool, label, text });
    }
  }

  // No arrays and no failure: a single-record result. Keep it as one item so a
  // tool that returns a flat object is not silently dropped — but only if the
  // object says something. A result that carries nothing except the envelope it
  // came in is not evidence, and on the live Sudan brief one became a citable
  // item reading "scope: country; generatedAt: 2026-09-01T…". That is a fact
  // about the request, offered to a model under instructions to cite what it is
  // given.
  if (items.length === 0 && errors.length === 0 && hasSubstance(output)) {
    const used = new Set<string>();
    const label = labelOf(output, tool, used);
    const body = textOf(output, used);
    const rest = bodyOf(output, used);
    const text = body ? clip(rest ? `${body} (${rest})` : body) : clip(rest);
    if (text) items.push({ id: nextId(), tool, label, text });
  }

  return { items, errors };
}

/** One line describing a tool result, for the `tool-result` trace event. */
export function summariseResult(harvested: Harvest): string {
  if (harvested.errors.length > 0 && harvested.items.length === 0) {
    return harvested.errors[0].message;
  }
  if (harvested.items.length === 0) return 'no records returned';

  const labels = [...new Set(harvested.items.map((item) => item.label.split(' · ')[0]))];
  const shown = labels.slice(0, 3).join(', ');
  const more = labels.length > 3 ? ` +${labels.length - 3}` : '';
  return `${harvested.items.length} record${harvested.items.length === 1 ? '' : 's'} — ${shown}${more}`;
}

/** One line describing a tool call's arguments, for the `tool-called` event. */
export function summariseArgs(input: unknown): string {
  if (!isRecord(input)) return '';
  return Object.entries(input)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join(' ')
    .slice(0, 160);
}

/**
 * Evidence as it is handed to a draft or verify call: numbered, labelled, and
 * capped. The cap is on the digest rather than per item because a section that
 * gathered from three tools should not get three times the budget.
 */
export function formatEvidence(items: EvidenceItem[], maxChars = 3_400): string {
  if (items.length === 0) return '(no evidence was retrieved for this section)';

  const lines: string[] = [];
  let used = 0;
  for (const item of items) {
    const line = `[${item.id}] ${item.label}: ${item.text}`;
    if (used + line.length > maxChars) break;
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join('\n');
}
