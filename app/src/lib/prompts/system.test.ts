import { describe, expect, it } from 'vitest';

import { haiTools } from '@/lib/tools';

import { SYSTEM_PROMPT } from './system';

describe('SYSTEM_PROMPT', () => {
  /*
   * The defect this guards against shipped silently. `hazards_context` was
   * registered in `lib/tools/index.ts` and therefore serialised into every
   * chat request — about 335 tokens of schema on every single turn — while the
   * prompt named only the other three, so the model was being charged for a
   * tool it had not been told it had.
   *
   * The cost of that was not only wasted tokens. Asked "what disaster alerts
   * are currently active for Sudan?", the model called *no tool at all* and
   * would have answered from memory, which is precisely the failure the whole
   * grounding section exists to prevent. Naming the tool fixed that question
   * and cost 22 tokens.
   *
   * Asserted against the live registry rather than a hard-coded list, so a
   * fifth tool added later fails here until the prompt routes questions to it.
   */
  it('names every registered tool, so none is paid for and never reached for', () => {
    const unnamed = Object.keys(haiTools).filter((name) => !SYSTEM_PROMPT.includes(name));
    expect(unnamed).toEqual([]);
  });

  it('still carries the rules that make naming a tool worth anything', () => {
    // A prompt that lists tools but drops the obligation to call them would
    // pass the test above while losing the point of it.
    expect(SYSTEM_PROMPT).toMatch(/Call a tool BEFORE you answer/);
    expect(SYSTEM_PROMPT).toMatch(/Confidence is not verification/);
  });
});
