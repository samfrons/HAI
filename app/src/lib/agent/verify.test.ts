import { describe, expect, it } from 'vitest';

import { scriptedModel, text } from './__testing__/mock-model';
import type { EvidenceItem } from './evidence';
import { TokenPacer } from './pacer';
import { UNVERIFIED_MARK } from './render';
import { annotate, extractClaims, verifySection } from './verify';

const pacer = new TokenPacer(8_000, false);

const evidence: EvidenceItem[] = [
  {
    id: 'e1',
    tool: 'humanitarian_data',
    label: 'HDX HAPI · food_security',
    text: 'Sudan IPC acute food insecurity: 8,500,000 people in Phase 3 or above, reference period 2026-06 to 2026-09.',
  },
  {
    id: 'e2',
    tool: 'search_standards',
    label: 'sphere · WASH standard 2.1',
    text: 'The minimum water quantity for drinking, cooking and personal hygiene is 15 litres per person per day.',
  },
];

describe('extractClaims', () => {
  it('pulls the sentences that assert something checkable', () => {
    const claims = extractClaims(
      'Sudan faces a deepening crisis affecting many communities.\n' +
        '- 8,500,000 people are in IPC Phase 3 or above (HDX HAPI · food_security).\n' +
        '- The minimum water standard is 15 litres per person per day (sphere · WASH standard 2.1).',
    );

    expect(claims).toHaveLength(2);
    expect(claims[0]).toContain('8,500,000');
    expect(claims[1]).toContain('15 litres');
  });

  it('ignores framing prose that asserts no figure or standard', () => {
    expect(extractClaims('This section sets out the operating context for the response.')).toEqual([]);
  });

  it('does not run away on a long section', () => {
    const line = '- 1,000,000 people were reached in the period (source).\n';
    expect(extractClaims(line.repeat(30)).length).toBeLessThanOrEqual(6);
  });
});

describe('verifySection', () => {
  /*
   * The cheap path. A figure that is literally in the evidence, in a sentence
   * about the same subject, must be settled without a model call at all — both
   * because it is free and because string equality is a stronger guarantee than
   * a model's opinion about string equality.
   */
  it('settles a figure that is in the evidence without asking the model', async () => {
    let modelCalled = false;
    const model = scriptedModel(() => {
      modelCalled = true;
      return [text('1|unverifiable|-')];
    });

    const result = await verifySection({
      sectionId: 'needs',
      markdown:
        'Some 8,500,000 people in Sudan are in IPC Phase 3 acute food insecurity or above, reference period 2026-06 (HDX HAPI · food_security).',
      evidence,
      model,
      pacer,
    });

    expect(modelCalled).toBe(false);
    expect(result.checks[0].verdict).toBe('supported');
    expect(result.checks[0].source).toBe('HDX HAPI · food_security');
    expect(result.flagged).toBe(0);
    expect(result.markdown).not.toContain(UNVERIFIED_MARK);
  });

  /*
   * The failure this whole feature exists to catch: a fluent, plausible,
   * correctly-formatted figure that appears in none of the retrieved evidence.
   * It must end up marked in the prose, not quietly shipped.
   */
  it('flags a figure that appears nowhere in the evidence', async () => {
    const model = scriptedModel(() => [text('1|unsupported|-')]);

    const result = await verifySection({
      sectionId: 'needs',
      markdown: 'An estimated 12,300,000 people are displaced across the country.',
      evidence,
      model,
      pacer,
    });

    expect(result.checks[0].verdict).toBe('unsupported');
    expect(result.flagged).toBe(1);
    expect(result.markdown).toBe(
      `An estimated 12,300,000 people are displaced across the country. ${UNVERIFIED_MARK}`,
    );
  });

  it('accepts a paraphrase the string pass could not settle', async () => {
    const model = scriptedModel(() => [text('1|supported|sphere · WASH standard 2.1')]);

    const result = await verifySection({
      sectionId: 'guidance',
      markdown: 'Each person needs at least fifteen litres of water daily for drinking and hygiene.',
      evidence,
      model,
      pacer,
    });

    expect(result.checks[0].verdict).toBe('supported');
    expect(result.flagged).toBe(0);
  });

  /*
   * A verifier that fails open verifies nothing. If the check itself breaks, or
   * the model replies with something unparseable, every deferred claim must end
   * up flagged rather than waved through.
   */
  it('flags rather than passes when the check itself fails', async () => {
    const model = scriptedModel(() => {
      throw new Error('endpoint unreachable');
    });

    const result = await verifySection({
      sectionId: 'needs',
      markdown: 'An estimated 12,300,000 people are displaced across the country.',
      evidence,
      model,
      pacer,
    });

    expect(result.checks[0].verdict).toBe('unverifiable');
    expect(result.markdown).toContain(UNVERIFIED_MARK);
  });

  it('flags rather than passes when the model replies with nonsense', async () => {
    const model = scriptedModel(() => [text('I think claim one is probably fine.')]);

    const result = await verifySection({
      sectionId: 'needs',
      markdown: 'An estimated 12,300,000 people are displaced across the country.',
      evidence,
      model,
      pacer,
    });

    expect(result.checks[0].verdict).toBe('unverifiable');
    expect(result.flagged).toBe(1);
  });

  it('flags every claim in a section drafted with no evidence at all', async () => {
    let modelCalled = false;
    const model = scriptedModel(() => {
      modelCalled = true;
      return [text('1|supported|-')];
    });

    const result = await verifySection({
      sectionId: 'funding',
      markdown: 'The appeal requires 2,600,000,000 USD for the current year.',
      evidence: [],
      model,
      pacer,
    });

    // No evidence means nothing can support anything; spending a model call to
    // be told so would be a waste of the token budget.
    expect(modelCalled).toBe(false);
    expect(result.flagged).toBe(1);
    expect(result.markdown).toContain(UNVERIFIED_MARK);
  });
});

describe('annotate', () => {
  it('marks the claim in place, not in a footnote at the end', () => {
    const markdown = '- 1,000,000 people in need (source).\n- 2,000,000 targeted (source).';
    const output = annotate(markdown, [
      { claim: '1,000,000 people in need (source).', verdict: 'supported' },
      { claim: '2,000,000 targeted (source).', verdict: 'unsupported' },
    ]);

    expect(output).toBe(
      `- 1,000,000 people in need (source).\n- 2,000,000 targeted (source). ${UNVERIFIED_MARK}`,
    );
  });

  it('leaves the section alone rather than mangling it when a claim cannot be located', () => {
    const markdown = 'Body text.';
    expect(annotate(markdown, [{ claim: 'not present here', verdict: 'unsupported' }])).toBe(markdown);
  });
});
