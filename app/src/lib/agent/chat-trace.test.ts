import { describe, expect, it } from 'vitest';

import { traceFromMessage } from './chat-trace';

describe('traceFromMessage', () => {
  it('reports a finished search as a source consulted', () => {
    const events = traceFromMessage({
      parts: [
        { type: 'text', text: 'The minimum is 15 litres.' },
        {
          type: 'tool-search_standards',
          toolCallId: 'c1',
          state: 'output-available',
          input: { query: 'water per person per day', source: 'all' },
          output: { chunks: [{ source: 'sphere' }, { source: 'sphere' }] },
        },
      ],
    });

    expect(events).toEqual([
      {
        type: 'tool-called',
        at: 0,
        stepId: 'chat',
        callId: 'c1',
        tool: 'search_standards',
        args: 'query=water per person per day source=all',
      },
      {
        type: 'tool-result',
        at: 0,
        stepId: 'chat',
        callId: 'c1',
        tool: 'search_standards',
        ok: true,
        summary: '2 chunks',
      },
    ]);
  });

  it('reports a dataset with no coverage as a call that did not answer', () => {
    const events = traceFromMessage({
      parts: [
        {
          type: 'tool-humanitarian_data',
          toolCallId: 'c2',
          state: 'output-available',
          input: { country_iso3: 'SDN', dataset: 'funding' },
          output: { available: false, detail: 'HAPI holds no funding data for SDN.' },
        },
      ],
    });

    expect(events[1]).toMatchObject({
      ok: false,
      summary: 'HAPI holds no funding data for SDN.',
    });
  });

  it('reports an empty retrieval as a call that did not answer', () => {
    const events = traceFromMessage({
      parts: [
        {
          type: 'tool-search_standards',
          toolCallId: 'c3',
          state: 'output-available',
          input: { query: 'blockchain' },
          output: { chunks: [], notice: 'No passages matched this query.' },
        },
      ],
    });

    expect(events[1]).toMatchObject({ ok: false, summary: 'No passages matched this query.' });
  });

  it('carries a tool failure through rather than reporting a success', () => {
    const events = traceFromMessage({
      parts: [
        {
          type: 'tool-crisis_updates',
          toolCallId: 'c4',
          state: 'output-error',
          input: { query: 'displacement' },
          errorText: 'feed unreachable',
        },
      ],
    });

    expect(events[1]).toMatchObject({ ok: false, summary: 'feed unreachable' });
  });

  it('leaves a call still in flight without a result row', () => {
    const events = traceFromMessage({
      parts: [
        {
          type: 'tool-search_standards',
          toolCallId: 'c5',
          state: 'input-available',
          input: { query: 'shelter' },
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('tool-called');
  });

  it('produces nothing for a turn that called no tool', () => {
    expect(traceFromMessage({ parts: [{ type: 'text', text: 'Hello.' }] })).toEqual([]);
  });

  /*
   * Load-bearing, and the reason this file exists rather than the chat route
   * emitting events: chat answers are not verified. A verdict here would read as
   * the same guarantee the deliverables page makes, and it is not one.
   */
  it('never claims a claim was checked', () => {
    const events = traceFromMessage({
      parts: [
        {
          type: 'tool-search_standards',
          toolCallId: 'c6',
          state: 'output-available',
          input: { query: 'water' },
          output: { chunks: [{ source: 'sphere' }] },
        },
      ],
    });

    expect(events.some((event) => event.type === 'check-run')).toBe(false);
  });
});
