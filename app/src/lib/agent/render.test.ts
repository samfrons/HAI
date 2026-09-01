import { describe, expect, it } from 'vitest';

import type { EvidenceItem } from './evidence';
import {
  INVENTED_CITATION_MARK,
  UNVERIFIED_MARK,
  assembleDocument,
  documentFilename,
  foldRun,
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

describe('foldRun', () => {
  const at = 1;

  it('assembles the document in the order the plan declared', () => {
    const run = foldRun(
      [
        {
          type: 'plan-created',
          at,
          workflowId: 'situation-brief',
          subject: 'Sudan',
          iso3: 'SDN',
          sections: [
            { id: 'overview', heading: 'Overview' },
            { id: 'needs', heading: 'Needs' },
          ],
        },
        // Arrives second; must still render under Overview.
        { type: 'draft-section', at, sectionId: 'needs', heading: 'Needs', markdown: 'N.' },
        { type: 'draft-section', at, sectionId: 'overview', heading: 'Overview', markdown: 'O.' },
      ],
      'Situation brief',
    );

    expect(run.title).toBe('Situation brief — Sudan');
    expect(run.sections.map((section) => section.id)).toEqual(['overview', 'needs']);
  });

  it('shows a section filling in before it is finished', () => {
    const run = foldRun(
      [
        { type: 'draft-delta', at, sectionId: 'overview', delta: 'Sudan faces ' },
        { type: 'draft-delta', at, sectionId: 'overview', delta: 'a crisis.' },
      ],
      'Situation brief',
    );
    expect(run.sections[0].markdown).toBe('Sudan faces a crisis.');
  });

  /*
   * The ordering that matters most: the verified body must win over the drafted
   * one, or the flags this whole feature exists to show would be overwritten by
   * the unflagged text they were added to.
   */
  it('replaces a drafted section with its verified version', () => {
    const run = foldRun(
      [
        { type: 'draft-delta', at, sectionId: 'needs', delta: '2,000,000 in need.' },
        { type: 'draft-section', at, sectionId: 'needs', heading: 'Needs', markdown: '2,000,000 in need.' },
        {
          type: 'section-verified',
          at,
          sectionId: 'needs',
          markdown: `2,000,000 in need. ${UNVERIFIED_MARK}`,
          flagged: 1,
        },
        // A straggling delta must not append underneath the flag.
        { type: 'draft-delta', at, sectionId: 'needs', delta: ' extra' },
      ],
      'Situation brief',
    );

    expect(run.sections[0].markdown).toBe(`2,000,000 in need. ${UNVERIFIED_MARK}`);
  });

  it('reports a finished run and its flag count', () => {
    const run = foldRun(
      [{ type: 'workflow-done', at, generatedAt: '2026-09-01T10:00:00.000Z', sections: 6, flagged: 2 }],
      'Situation brief',
    );
    expect(run.finished).toBe(true);
    expect(run.flagged).toBe(2);
    expect(run.failed).toBeNull();
  });

  it('surfaces a failed run rather than rendering an empty document', () => {
    const run = foldRun(
      [{ type: 'workflow-error', at, message: 'endpoint unreachable' }],
      'Situation brief',
    );
    expect(run.failed).toBe('endpoint unreachable');
    expect(run.finished).toBe(true);
  });

  /*
   * A run cut short by the serverless timeout produces no terminal event at
   * all. What it produced must still be there, and `finished` must stay false so
   * the page can say the document is partial.
   */
  it('keeps what a truncated run produced, and does not call it finished', () => {
    const run = foldRun(
      [
        {
          type: 'plan-created',
          at,
          workflowId: 'situation-brief',
          subject: 'Sudan',
          sections: [
            { id: 'overview', heading: 'Overview' },
            { id: 'needs', heading: 'Needs' },
          ],
        },
        { type: 'draft-section', at, sectionId: 'overview', heading: 'Overview', markdown: 'O.' },
      ],
      'Situation brief',
    );

    expect(run.finished).toBe(false);
    expect(run.sections[0].markdown).toBe('O.');
    expect(run.sections[1].markdown).toBe('');
  });
});
