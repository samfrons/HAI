import { tool, type ToolSet } from 'ai';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { scriptedModel, text, toolCall } from './__testing__/mock-model';
import { runWorkflow, selectTools } from './engine';
import { TokenPacer } from './pacer';
import { UNVERIFIED_MARK } from './render';
import type { TraceEvent, WorkflowDefinition } from './types';

const pacer = () => new TokenPacer(8_000, false);

/** A two-section brief plus the synthesised caveats block — a full run, fast. */
const workflow: WorkflowDefinition = {
  id: 'test-brief',
  title: 'Test brief',
  subjectKind: 'country',
  description: 'test',
  sections: [
    {
      id: 'needs',
      heading: 'Needs',
      tools: ['humanitarian_data'],
      gatherBrief: 'Get the caseload.',
      brief: 'Report the caseload.',
    },
    {
      id: 'sources',
      heading: 'Sources and caveats',
      tools: [],
      gatherBrief: '',
      brief: '',
      synthesised: 'sources-and-caveats',
      skipVerification: true,
    },
  ],
};

const tools: ToolSet = {
  humanitarian_data: tool({
    description: 'Country humanitarian figures.',
    inputSchema: z.object({ country_iso3: z.string(), dataset: z.string() }),
    execute: async () => ({
      figures: [
        {
          source: 'HDX HAPI',
          indicator: 'people_in_need',
          value: 24800000,
          reference_period: '2026-01 to 2026-12',
        },
      ],
    }),
  }),
};

/**
 * The script a well-behaved model would follow for the workflow above: search
 * once, then stop searching. Fresh per test, because the gather step is a loop
 * and "have I already called the tool" is part of what is being scripted.
 */
function goodRun(): (prompt: string) => ReturnType<typeof text>[] {
  let gathered = false;
  return (prompt) => {
    if (prompt.includes('ISO 3166-1 alpha-3 code')) return [text('Sudan|SDN')];
    if (prompt.includes('Retrieve the evidence')) {
      if (gathered) return [text('')];
      gathered = true;
      return [toolCall('humanitarian_data', { country_iso3: 'SDN', dataset: 'humanitarian_needs' })];
    }
    if (prompt.includes('CLAIMS:')) return [text('1|supported|HDX HAPI · 2026-01 to 2026-12')];
    return [
      text('An estimated 24,800,000 people are in need, reference period 2026-01 to 2026-12 [e1].'),
    ];
  };
}

async function collect(generator: AsyncGenerator<TraceEvent>): Promise<TraceEvent[]> {
  const events: TraceEvent[] = [];
  for await (const event of generator) events.push(event);
  return events;
}

function ofType<T extends TraceEvent['type']>(
  events: TraceEvent[],
  type: T,
): Extract<TraceEvent, { type: T }>[] {
  return events.filter((event) => event.type === type) as Extract<TraceEvent, { type: T }>[];
}

describe('runWorkflow', () => {
  it('publishes the section checklist before any of it exists', async () => {
    const events = await collect(
      runWorkflow(
        { workflow, subject: 'sudan' },
        { model: scriptedModel(goodRun()), tools, pacer: pacer() },
      ),
    );

    const plan = ofType(events, 'plan-created')[0];
    expect(plan).toBeDefined();
    expect(plan.subject).toBe('Sudan');
    expect(plan.iso3).toBe('SDN');
    expect(plan.sections.map((section) => section.id)).toEqual(['needs', 'sources']);

    // The plan must arrive before the first section's work, or the trace panel
    // has nothing to tick through.
    expect(events.indexOf(plan)).toBeLessThan(
      events.findIndex((event) => event.type === 'tool-called'),
    );
  });

  it('reports each tool call and what it returned', async () => {
    const events = await collect(
      runWorkflow(
        { workflow, subject: 'Sudan' },
        { model: scriptedModel(goodRun()), tools, pacer: pacer() },
      ),
    );

    const called = ofType(events, 'tool-called')[0];
    expect(called.tool).toBe('humanitarian_data');
    expect(called.args).toContain('country_iso3=SDN');

    const result = ofType(events, 'tool-result')[0];
    expect(result.ok).toBe(true);
    expect(result.summary).toContain('HDX HAPI');
    expect(result.callId).toBe(called.callId);
  });

  it('streams the section as it is written, then publishes it whole', async () => {
    const events = await collect(
      runWorkflow(
        { workflow, subject: 'Sudan' },
        { model: scriptedModel(goodRun()), tools, pacer: pacer() },
      ),
    );

    const deltas = ofType(events, 'draft-delta').filter((event) => event.sectionId === 'needs');
    expect(deltas.length).toBeGreaterThan(1);

    const section = ofType(events, 'draft-section').find((event) => event.sectionId === 'needs');
    expect(section?.markdown).toContain('24,800,000');
    // The citation id has become a label the reader can check.
    expect(section?.markdown).toContain('(HDX HAPI · 2026-01 to 2026-12)');
    expect(section?.markdown).not.toContain('[e1]');
  });

  it('checks each claim and reports the verdict', async () => {
    const events = await collect(
      runWorkflow(
        { workflow, subject: 'Sudan' },
        { model: scriptedModel(goodRun()), tools, pacer: pacer() },
      ),
    );

    const checks = ofType(events, 'check-run');
    expect(checks).toHaveLength(1);
    expect(checks[0].verdict).toBe('supported');
    expect(ofType(events, 'section-verified')[0].flagged).toBe(0);
    expect(ofType(events, 'workflow-done')[0].flagged).toBe(0);
  });

  /*
   * The whole point of the feature, exercised end to end: the model writes a
   * figure that the tool never returned. It must survive to the reader marked,
   * be counted in the run total, and be named in the caveats section.
   */
  it('flags a drafted figure that the evidence does not contain', async () => {
    let gathered = false;
    const model = scriptedModel((prompt) => {
      if (prompt.includes('ISO 3166-1 alpha-3 code')) return [text('Sudan|SDN')];
      if (prompt.includes('Retrieve the evidence')) {
        if (gathered) return [text('')];
        gathered = true;
        return [toolCall('humanitarian_data', { country_iso3: 'SDN', dataset: 'humanitarian_needs' })];
      }
      if (prompt.includes('CLAIMS:')) return [text('1|unsupported|-')];
      return [text('An estimated 30,100,000 people are in need across the country.')];
    });

    const events = await collect(
      runWorkflow({ workflow, subject: 'Sudan' }, { model, tools, pacer: pacer() }),
    );

    expect(ofType(events, 'check-run')[0].verdict).toBe('unsupported');

    const verified = ofType(events, 'section-verified')[0];
    expect(verified.flagged).toBe(1);
    expect(verified.markdown).toContain(UNVERIFIED_MARK);
    expect(ofType(events, 'workflow-done')[0].flagged).toBe(1);

    const caveats = ofType(events, 'draft-section').find((event) => event.sectionId === 'sources');
    expect(caveats?.markdown).toContain('1 claim');
  });

  /*
   * The `situation.py` contract: a source that fails degrades its section and
   * lands in the caveats. It must not end the run, and it must not vanish.
   */
  it('degrades the section and names the source when a tool fails', async () => {
    const failing: ToolSet = {
      humanitarian_data: tool({
        description: 'Country humanitarian figures.',
        inputSchema: z.object({ country_iso3: z.string(), dataset: z.string() }),
        execute: async () => ({
          available: false,
          reason: 'no_coverage',
          detail: 'HAPI holds no needs data for SDN.',
        }),
      }),
    };

    let gathered = false;
    const model = scriptedModel((prompt) => {
      if (prompt.includes('ISO 3166-1 alpha-3 code')) return [text('Sudan|SDN')];
      if (prompt.includes('Retrieve the evidence')) {
        if (gathered) return [text('')];
        gathered = true;
        return [toolCall('humanitarian_data', { country_iso3: 'SDN', dataset: 'humanitarian_needs' })];
      }
      if (prompt.includes('CLAIMS:')) return [text('1|unverifiable|-')];
      return [text('No caseload figures were available for this country from HDX HAPI.')];
    });

    const events = await collect(
      runWorkflow({ workflow, subject: 'Sudan' }, { model, tools: failing, pacer: pacer() }),
    );

    const sourceErrors = ofType(events, 'source-error');
    expect(sourceErrors.map((event) => event.message)).toContain(
      'HAPI holds no needs data for SDN.',
    );

    // The run still finishes and still produces a document.
    expect(ofType(events, 'workflow-done')).toHaveLength(1);
    const caveats = ofType(events, 'draft-section').find((event) => event.sectionId === 'sources');
    expect(caveats?.markdown).toContain('HAPI holds no needs data for SDN.');
    expect(caveats?.markdown).toContain('Source issues (degraded sections)');
  });

  /*
   * The grounding failure the whole system prompt exists to prevent, at the
   * step level: a model that answers a gather step from memory rather than
   * calling anything. The engine must not accept it.
   */
  it('forces a tool call when the gather step tried to answer from memory', async () => {
    const prompts: string[] = [];
    const model = scriptedModel((prompt) => {
      prompts.push(prompt);
      if (prompt.includes('ISO 3166-1 alpha-3 code')) return [text('Sudan|SDN')];
      if (prompt.includes('Retrieve the evidence')) {
        // First attempt: prose instead of a tool call.
        const attempts = prompts.filter((entry) => entry.includes('Retrieve the evidence')).length;
        if (attempts === 1) return [text('I already know Sudan has 24.8 million people in need.')];
        return attempts === 2
          ? [toolCall('humanitarian_data', { country_iso3: 'SDN', dataset: 'humanitarian_needs' })]
          : [text('')];
      }
      if (prompt.includes('CLAIMS:')) return [text('1|supported|HDX HAPI · people_in_need')];
      return [text('An estimated 24,800,000 people are in need [e1].')];
    });

    const events = await collect(
      runWorkflow({ workflow, subject: 'Sudan' }, { model, tools, pacer: pacer() }),
    );

    expect(ofType(events, 'tool-called')).toHaveLength(1);
    expect(ofType(events, 'tool-result')[0].ok).toBe(true);
  });

  it('assembles the caveats section from the run rather than from the model', async () => {
    const events = await collect(
      runWorkflow(
        { workflow, subject: 'Sudan' },
        { model: scriptedModel(goodRun()), tools, pacer: pacer() },
      ),
    );

    const caveats = ofType(events, 'draft-section').find((event) => event.sectionId === 'sources');
    expect(caveats?.markdown).toContain('Sources consulted');
    expect(caveats?.markdown).toContain('HDX HAPI — 1 record');
    expect(caveats?.markdown).toContain('has not been reviewed by anyone');
    expect(caveats?.markdown).toMatch(/Generated \d{4}-\d{2}-\d{2}T/);
  });

  it('ends with an error event rather than a broken stream', async () => {
    const model = scriptedModel(() => {
      throw new Error('endpoint down');
    });

    const events = await collect(
      runWorkflow(
        { workflow: { ...workflow, subjectKind: 'topic' }, subject: 'Sudan' },
        { model, tools, pacer: pacer() },
      ),
    );

    // The gather failure is contained; the run still reaches a terminal event.
    expect(events.at(-1)?.type).toBe('workflow-done');
    expect(ofType(events, 'source-error').length).toBeGreaterThan(0);
  });
});

describe('selectTools', () => {
  /*
   * The registry is edited by other work in parallel with this engine. A
   * template naming a tool that does not exist yet must degrade to the tools
   * that do, not throw — and a tool added to the registry must become available
   * to every template that names it with no change here.
   */
  it('skips a tool that is not registered rather than failing the section', () => {
    const selected = selectTools(tools, ['humanitarian_data', 'not_yet_built']);
    expect(selected.names).toEqual(['humanitarian_data']);
    expect(Object.keys(selected.set)).toEqual(['humanitarian_data']);
  });

  it('returns nothing when a template names only unknown tools', () => {
    expect(selectTools(tools, ['nope']).names).toEqual([]);
  });
});
