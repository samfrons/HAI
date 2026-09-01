import { describe, expect, it } from 'vitest';

import type { EvidenceItem } from './evidence';
import {
  INVENTED_CITATION_MARK,
  UNVERIFIED_MARK,
  assembleDocument,
  documentFilename,
  renderSection,
  renderSourcesAndCaveats,
} from './render';

const evidence: EvidenceItem[] = [
  { id: 'e1', tool: 'search_standards', label: 'sphere · WASH 2.1', text: '15 litres' },
  { id: 'e2', tool: 'humanitarian_data', label: 'HDX HAPI · funding', text: '$1.2bn' },
];

describe('renderSection', () => {
  it('turns citation ids into the source labels a reader can check', () => {
    const { markdown, invented } = renderSection(
      'The minimum is 15 litres per person per day [e1].',
      evidence,
    );
    expect(markdown).toBe('The minimum is 15 litres per person per day (sphere · WASH 2.1).');
    expect(invented).toBe(0);
  });

  /*
   * The failure this exists for: a model that produces a claim and then
   * produces a provenance for it. `[e9]` where the evidence stopped at `[e2]`
   * is a fabricated citation, and it is more dangerous than an uncited claim
   * because it reads as more trustworthy. It must be visible in the prose.
   */
  it('marks a citation that refers to no evidence and counts it', () => {
    const { markdown, invented } = renderSection('Funding reached $3bn [e9].', evidence);
    expect(markdown).toContain(INVENTED_CITATION_MARK);
    expect(markdown).not.toContain('[e9]');
    expect(invented).toBe(1);
  });

  it('drops a heading the draft step was told not to write', () => {
    const { markdown } = renderSection('## Overview\n\nSudan faces a crisis.', evidence);
    expect(markdown).toBe('Sudan faces a crisis.');
  });
});

describe('renderSourcesAndCaveats', () => {
  it('names every degraded source once, however many sections hit it', () => {
    const markdown = renderSourcesAndCaveats({
      evidence,
      errors: [
        { source: 'hazards_context · worldbank', message: 'HTTP 503' },
        { source: 'hazards_context · worldbank', message: 'HTTP 503' },
      ],
      generatedAt: '2026-09-01T10:00:00.000Z',
      flagged: 0,
    });

    expect(markdown.match(/HTTP 503/g)).toHaveLength(1);
    expect(markdown).toContain('Source issues (degraded sections)');
    expect(markdown).toContain('2026-09-01T10:00:00.000Z');
  });

  it('states plainly when nothing degraded', () => {
    const markdown = renderSourcesAndCaveats({
      evidence,
      errors: [],
      generatedAt: '2026-09-01T10:00:00.000Z',
      flagged: 0,
    });
    expect(markdown).toContain('Every source consulted returned data');
    expect(markdown).toContain('Every claim in this document matched retrieved evidence');
  });

  it('tells the reader how many claims to check before sending the document on', () => {
    const markdown = renderSourcesAndCaveats({
      evidence,
      errors: [],
      generatedAt: '2026-09-01T10:00:00.000Z',
      flagged: 2,
    });
    expect(markdown).toContain('2 claims');
    expect(markdown).toContain(UNVERIFIED_MARK);
  });

  it('counts each source once per record, not once per section', () => {
    const markdown = renderSourcesAndCaveats({
      evidence: [...evidence, { ...evidence[0], id: 'e3' }],
      errors: [],
      generatedAt: '2026-09-01T10:00:00.000Z',
      flagged: 0,
    });
    expect(markdown).toContain('sphere — 2 records');
    expect(markdown).toContain('HDX HAPI — 1 record');
  });
});

describe('assembleDocument', () => {
  it('builds the exported markdown from the same bodies the page shows', () => {
    const markdown = assembleDocument('Situation brief — Sudan', [
      { id: 'overview', heading: 'Overview', markdown: 'Body one.' },
      { id: 'empty', heading: 'Hazards', markdown: '   ' },
      { id: 'needs', heading: 'Needs', markdown: 'Body two.' },
    ]);

    expect(markdown).toBe(
      '# Situation brief — Sudan\n\n## Overview\n\nBody one.\n\n## Needs\n\nBody two.\n',
    );
  });
});

describe('documentFilename', () => {
  it('sorts by date and survives every filesystem', () => {
    expect(documentFilename('Situation brief — Sudan', new Date('2026-09-01T10:00:00Z'))).toBe(
      'situation-brief-sudan-2026-09-01.md',
    );
  });
});
