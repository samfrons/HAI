import { describe, expect, it } from 'vitest';

import { maskSnippet, screenForPii, type PiiFindingType } from './pii';

function types(input: string): PiiFindingType[] {
  return screenForPii(input).findings.map((finding) => finding.type);
}

function flagged(input: string): boolean {
  return screenForPii(input).flagged;
}

/**
 * The two halves of this suite are not equally important. Missing a phone
 * number is a bug; blocking "15 litres per person per day" is a product
 * failure, because a practitioner who gets refused once on a legitimate Sphere
 * question stops trusting every refusal after it. The false-positive block is
 * the one that must never regress.
 */

describe('maskSnippet', () => {
  it('keeps the shape but not the value', () => {
    const masked = maskSnippet('+254712345678');
    expect(masked).toBe('+25•••••••••8');
    expect(masked).not.toContain('7123456');
  });

  it('preserves punctuation so the user can recognise what was caught', () => {
    expect(maskSnippet('amina.hassan@example.org')).toBe('am•••.••••••@•••••••.••g');
  });

  it('truncates long values', () => {
    const masked = maskSnippet('a'.repeat(200));
    expect(masked.length).toBeLessThanOrEqual(46);
    expect(masked.endsWith('…')).toBe(true);
  });

  it('does not leak a short value through the keep-first-two rule', () => {
    expect(maskSnippet('ab')).toBe('ab');
    expect(maskSnippet('abcd')).toBe('ab••');
  });
});

describe('phone numbers', () => {
  it.each([
    ['+254712345678', 'Kenya, E.164 unspaced'],
    ['+254 712 345 678', 'Kenya, spaced'],
    ['+44 20 7946 0958', 'UK, spaced'],
    ['+880 1712-345678', 'Bangladesh, mixed separators'],
    ['+964 (750) 123 4567', 'Iraq, parenthesised'],
    ['+1-202-555-0143', 'US, dashed'],
  ])('detects %s (%s)', (value) => {
    expect(types(`Contact them on ${value} tomorrow.`)).toContain('phone');
  });

  it('detects a labelled national number without a country code', () => {
    expect(types('Mobile: 0712 345 678')).toContain('phone');
    expect(types('tel. 0912345678')).toContain('phone');
    expect(types('WhatsApp 077 123 4567')).toContain('phone');
  });

  it('detects an unlabelled national number with a trunk prefix', () => {
    expect(types('Reach the household on 0712345678 before the distribution.')).toContain(
      'phone',
    );
  });

  it('does not repeat the number back in the finding', () => {
    const { findings } = screenForPii('phone +254712345678');
    expect(findings[0].snippet).not.toContain('254712345678');
    expect(JSON.stringify(findings)).not.toContain('712345678');
  });
});

describe('phone false positives — humanitarian statistics', () => {
  it.each([
    'What are Sphere minimum water quantities per person per day?',
    'Sphere sets 15 litres per person per day as the basic survival water need.',
    'The standard is 7.5 to 15 litres per person per day, with 250 people per tap.',
    'Plan for 2100 kcal per person per day and 15 litres per person per day.',
    'One latrine per 20 people; 3.5 m2 of covered living space per person.',
    'OCHA reports 4,500,000 people in need and 2,300,000 targeted.',
    'The HRP requires USD 1,250,000,000 against 18,700,000 people in need.',
    'Crude mortality rate above 1 per 10,000 per day signals an emergency.',
    'Coverage rose from 45% to 78% between 2022 and 2024.',
    'Sphere Handbook 2018, WASH standard 2.1, indicator 2.1.3.',
    'Appeal MDRSS010 and operation MDRTR003 remain open.',
    'CERF allocation 23-RR-CEF-012 was disbursed in March.',
    'Flash Appeal 2024 requires 1.2 billion; EA-2024-0512 covers the gap.',
    'Measles vaccination coverage reached 95000 children under five.',
    'Reporting period 2023-01-01 to 2023-12-31.',
    'Population figures: 120000, 45000, 87000 across the three camps.',
  ])('does not flag: %s', (input) => {
    expect(screenForPii(input).findings.filter((f) => f.type === 'phone')).toEqual([]);
  });

  it('does not flag any pattern for the canonical Sphere question', () => {
    expect(flagged('What are Sphere minimum water quantities per person per day?')).toBe(
      false,
    );
  });
});

describe('email addresses', () => {
  it('detects an address', () => {
    expect(types('Write to amina.hassan@example.org for the file.')).toContain('email');
  });

  it('detects an address with a plus tag and a multi-level domain', () => {
    expect(types('a.hassan+case@sub.example.co.ke')).toContain('email');
  });

  it('does not flag an at-sign used as prose', () => {
    expect(types('Distribution @ 14:00 at site 3.')).not.toContain('email');
    expect(types('Meet @ the WASH tent.')).not.toContain('email');
  });
});

describe('case, registration and national identifiers', () => {
  it.each([
    'case #4512',
    'Case No. 4512',
    'beneficiary ID 44219',
    'household ID HH-2291',
    'registration number 88213',
    'ration card no 55120',
    'national ID 19870512345',
    'passport number AB1234567',
    'individual ref IND/2024/0912',
    'ProGres 806-13C01234',
  ])('detects %s', (value) => {
    expect(types(`Please look at ${value} and advise.`)).toContain('identifier');
  });

  it('detects an unlabelled ProGres-style number', () => {
    expect(types('The record is 806-13C01234, filed last week.')).toContain('identifier');
  });
});

describe('identifier false positives', () => {
  it.each([
    'The case fatality rate is 2.3% this week.',
    'Caseload rose to 12,000 households in June.',
    'Cholera caseload 4,500 with 32 deaths.',
    'Individuals reached: 45000 across 12 sites.',
    'The case definition changed in the 2018 revision.',
    'Refugees registered in 2024 numbered 120,000.',
    'File the report by 2024-06-30.',
    'IDP figures for 2023 stood at 3,400,000.',
    'This is standard 2.1 in the Sphere Handbook 2018 edition.',
    'CHS commitment 9 covers resource management.',
  ])('does not flag: %s', (input) => {
    expect(screenForPii(input).findings.filter((f) => f.type === 'identifier')).toEqual([]);
  });
});

describe('GPS coordinates', () => {
  it('detects a high-precision decimal pair', () => {
    expect(types('Site located at 0.0512, 40.3021 per the survey.')).toContain(
      'coordinates',
    );
  });

  it('detects a negative decimal pair', () => {
    expect(types('-1.29210, 36.82190')).toContain('coordinates');
  });

  it('detects a labelled coordinate', () => {
    expect(types('GPS: 2.345, 45.678')).toContain('coordinates');
    expect(types('lat 0.05 lon 40.30')).toContain('coordinates');
  });

  it('detects degrees-minutes-seconds', () => {
    expect(types(`Shelter at 0° 3' 4" N`)).toContain('coordinates');
  });
});

describe('coordinate false positives', () => {
  it.each([
    'Cluster coordination meets on Tuesdays.',
    'The ratio moved from 2.5 to 3.1 over the quarter.',
    'Budget lines 1.250, 3.400 in the revised HRP.',
    'Sphere indicators 2.1, 2.2 and 2.3 apply here.',
    'Growth of 1.5% against a baseline of 2.4%.',
    'Coordinate with the WASH cluster lead before the assessment.',
  ])('does not flag: %s', (input) => {
    expect(screenForPii(input).findings.filter((f) => f.type === 'coordinates')).toEqual(
      [],
    );
  });
});

describe('dates of birth', () => {
  it.each([
    'DOB 12/3/1989',
    'D.O.B. 12-03-1989',
    'date of birth: 1989-03-12',
    'born on 12 March 1989',
    'birth date March 12, 1989',
  ])('detects %s', (value) => {
    expect(types(`Record shows ${value} for the applicant.`)).toContain('date-of-birth');
  });

  it('flags the name-adjacent case with a distinct label', () => {
    const { findings } = screenForPii('Amina Hassan, DOB 12/3/1989');
    const dob = findings.find((f) => f.type === 'date-of-birth');
    expect(dob?.label).toBe('Date of birth alongside a name');
  });

  it('does not flag a plain reporting date', () => {
    expect(types('The assessment was completed on 12/03/2024.')).not.toContain(
      'date-of-birth',
    );
    expect(types('Data as of 2024-06-30.')).not.toContain('date-of-birth');
  });
});

describe('bulk person lists', () => {
  it('flags a pasted case list', () => {
    const list = [
      'Amina Hassan, 34, F, Block C4',
      'Yusuf Omar, 12, M, Block C4',
      'Halima Ali, 47, F, Block B2',
    ].join('\n');
    expect(types(list)).toContain('bulk-list');
  });

  it('flags a tab-separated roster', () => {
    const list = [
      'Fatima Noor\t28\tF\tTent 12',
      'Ibrahim Diallo\t51\tM\tTent 19',
      'Mariam Toure\t7\tF\tTent 04',
      'Sekou Camara\t35\tM\tTent 21',
    ].join('\n');
    expect(types(list)).toContain('bulk-list');
  });

  it('does not flag two rows — the threshold is three', () => {
    const list = ['Amina Hassan, 34, F, Block C4', 'Yusuf Omar, 12, M, Block C4'].join(
      '\n',
    );
    expect(types(list)).not.toContain('bulk-list');
  });

  it('reports a shape, never the rows', () => {
    const list = [
      'Amina Hassan, 34, F, Block C4',
      'Yusuf Omar, 12, M, Block C4',
      'Halima Ali, 47, F, Block B2',
    ].join('\n');
    const finding = screenForPii(list).findings.find((f) => f.type === 'bulk-list');
    expect(finding?.snippet).toBe('3 lines shaped as "name, age/sex, …"');
    expect(JSON.stringify(finding)).not.toContain('Amina');
  });
});

describe('bulk-list false positives — tables a practitioner legitimately pastes', () => {
  it('does not flag a country caseload table', () => {
    const table = [
      'Sierra Leone, 120,000, 45',
      'Burkina Faso, 2,000,000, 60',
      'South Sudan, 9,400,000, 72',
      'Sri Lanka, 340,000, 21',
    ].join('\n');
    expect(types(table)).not.toContain('bulk-list');
  });

  it('does not flag a Sphere indicator table', () => {
    const table = [
      'Water Supply, Sphere 2.1, 15 litres per person per day',
      'Water Quality, Sphere 2.2, 0 E. coli per 100ml',
      'Excreta Management, Sphere 3.2, 1 latrine per 20 people',
      'Shelter and Settlement, Sphere 3.1, 3.5 m2 per person',
    ].join('\n');
    expect(types(table)).not.toContain('bulk-list');
  });

  it('does not flag a CHS commitment list', () => {
    const table = [
      'Commitment 1, Relevance, 12 indicators',
      'Commitment 2, Effectiveness, 9 indicators',
      'Commitment 3, Resilience, 7 indicators',
    ].join('\n');
    expect(types(table)).not.toContain('bulk-list');
  });

  it('does not flag a funding table by agency', () => {
    const table = [
      'World Food Programme, 2024, 45',
      'Norwegian Refugee Council, 2024, 12',
      'Save the Children, 2024, 18',
      'Danish Refugee Council, 2024, 9',
    ].join('\n');
    expect(types(table)).not.toContain('bulk-list');
  });

  it('does not flag prose that happens to contain names of agencies and numbers', () => {
    const prose =
      'The World Food Programme reached 45,000 households in June.\n' +
      'The Norwegian Refugee Council covered 12,000 in July.\n' +
      'Save the Children supported 18,000 children in August.';
    expect(types(prose)).not.toContain('bulk-list');
  });
});

describe('the composite interception case', () => {
  const input =
    'Summarize: Amina Hassan, case #4512, DOB 12/3/1989, Dadaab block C4, phone +254712345678';

  it('flags it', () => {
    expect(flagged(input)).toBe(true);
  });

  it('names every pattern present', () => {
    const found = new Set(types(input));
    expect(found.has('phone')).toBe(true);
    expect(found.has('identifier')).toBe(true);
    expect(found.has('date-of-birth')).toBe(true);
  });

  it('never carries the raw values into the findings', () => {
    const serialised = JSON.stringify(screenForPii(input).findings);
    expect(serialised).not.toContain('254712345678');
    expect(serialised).not.toContain('4512');
    expect(serialised).not.toContain('12/3/1989');
  });

  it('attributes each finding to a named IASC principle', () => {
    for (const finding of screenForPii(input).findings) {
      expect(finding.principle.length).toBeGreaterThan(0);
      expect(finding.remedy.length).toBeGreaterThan(0);
    }
  });
});

describe('legitimate humanitarian questions pass untouched', () => {
  it.each([
    'What are Sphere minimum water quantities per person per day?',
    'How many litres per person per day does Sphere require for a health facility?',
    'What does CHS commitment 5 say about complaints handling?',
    'Summarise the IASC guidance on centrality of protection.',
    'What is the minimum covered living space per person in an emergency shelter?',
    'Compare the 2018 and 2011 Sphere WASH standards on latrine ratios.',
    'What are the SAM admission criteria for children 6-59 months?',
    'How should we calculate the general food ration for 12,000 people?',
    'What is the recommended ratio of latrines to people in a transit centre?',
    'Draft a distribution plan for 4,500 households across 6 sites.',
    'What does the Sphere Handbook say about 250 people per water point?',
    'Which IASC principles apply when sharing data with a government partner?',
  ])('passes: %s', (input) => {
    const result = screenForPii(input);
    expect(result.flagged, `unexpectedly flagged: ${JSON.stringify(result.findings)}`).toBe(
      false,
    );
  });
});

describe('input handling', () => {
  it('returns clean for empty input', () => {
    expect(screenForPii('')).toEqual({ flagged: false, findings: [] });
  });

  it('caps the number of findings so the refusal stays readable', () => {
    const many = Array.from({ length: 40 }, (_, i) => `phone +2547123456${i % 10}${i % 7}`).join(
      '\n',
    );
    expect(screenForPii(many).findings.length).toBeLessThanOrEqual(8);
  });

  it('screens a very large paste without hanging', () => {
    const large = `${'Sphere requires 15 litres per person per day. '.repeat(2000)}phone +254712345678`;
    const started = Date.now();
    screenForPii(large);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
