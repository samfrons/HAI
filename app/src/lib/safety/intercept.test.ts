import { describe, expect, it } from 'vitest';

import { buildInterceptionMessage, buildSafetyNotice } from './intercept';
import { screenForPii } from './pii';

const COMPOSITE =
  'Summarize: Amina Hassan, case #4512, DOB 12/3/1989, Dadaab block C4, phone +254712345678';

describe('buildInterceptionMessage', () => {
  const findings = screenForPii(COMPOSITE).findings;
  const message = buildInterceptionMessage(findings);

  it('never reproduces the flagged values', () => {
    for (const value of ['Amina', 'Hassan', '4512', '12/3/1989', '254712345678']) {
      expect(message).not.toContain(value);
    }
  });

  it('names which pattern was detected, masked', () => {
    expect(message).toContain('Telephone number');
    expect(message).toContain('Case or registration identifier');
    expect(message).toContain('+25•••••••••8');
  });

  it('cites the IASC guidance and the principles by name', () => {
    expect(message).toContain(
      'IASC Operational Guidance on Data Responsibility in Humanitarian Action',
    );
    expect(message).toContain('personal data protection');
    expect(message).toContain('confidentiality');
  });

  it('shows how to rephrase, not just what was refused', () => {
    expect(message).toContain('How to ask this so I can help');
    expect(message).toContain('The same question, in a form I can answer');
  });

  it('states that nothing was logged', () => {
    expect(message).toMatch(/not been logged/i);
  });

  it('reads as singular when one pattern was found', () => {
    const single = buildInterceptionMessage(screenForPii('phone +254712345678').findings);
    expect(single).toContain('a pattern that reads');
  });
});

describe('buildSafetyNotice', () => {
  const notice = buildSafetyNotice(screenForPii(COMPOSITE).findings);

  it('carries only masked snippets to the client', () => {
    const serialised = JSON.stringify(notice);
    expect(serialised).not.toContain('4512');
    expect(serialised).not.toContain('254712345678');
    expect(serialised).not.toContain('Amina');
  });

  it('deduplicates principles while keeping first-seen order', () => {
    expect(notice.principles[0]).toBe('personal data protection');
    expect(new Set(notice.principles).size).toBe(notice.principles.length);
  });

  it('links the responsible-use guide', () => {
    expect(notice.guideHref).toBe('/guides/responsible-use');
  });

  it('drops the reason and remedy prose the banner does not render', () => {
    for (const finding of notice.findings) {
      expect(Object.keys(finding).sort()).toEqual(['label', 'snippet', 'type']);
    }
  });
});
