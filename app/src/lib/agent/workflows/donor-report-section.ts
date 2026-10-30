/**
 * Donor report section.
 *
 * The narrower and more dangerous of the two templates, and the section order
 * reflects that. Donor reporting is where a humanitarian organisation is under
 * the most pressure to state a number it cannot support: the achievements
 * section is the one an officer writes at 11pm before a deadline, and it is the
 * one a wrong figure does the most damage in — it goes to the donor, it goes
 * into the next proposal, and it is what an audit reads back.
 *
 * So this template refuses to write it. The achievements section produces the
 * *format* an achievements narrative should take and the evidence standards it
 * must meet, with the organisation's own monitoring data left as the blank the
 * human fills. HAI has no access to a partner's output data and cannot get it;
 * a model asked to draft achievements with no data will produce fluent,
 * plausible, entirely invented ones, which is precisely the laundering the
 * system prompt already forbids in chat. The context, needs, and ask sections
 * are grounded in retrievable public figures and so are drafted normally.
 */

import type { WorkflowDefinition } from '../types';

export const donorReportSection: WorkflowDefinition = {
  id: 'donor-report-section',
  title: 'Donor report section',
  subjectKind: 'topic',
  description:
    'Context, needs and gaps, and the ask for a donor report — grounded in public figures, with the achievements narrative left as a structured template for your own monitoring data.',
  sections: [
    {
      id: 'context',
      heading: 'Context',
      tools: ['crisis_updates', 'hazards_context', 'humanitarian_data'],
      gatherBrief:
        'Get the operating context for this programme: recent situation reporting, active hazards, and the population baseline for the country or region named.',
      brief:
        'Set out the operating context a donor needs to understand this programme: what the situation is, how it has changed over the reporting period, and what constrains delivery. Prose, four to six sentences. Describe humanitarian consequences, never the politics of the conflict or the conduct of any party to it.',
    },
    {
      id: 'achievements',
      heading: 'Achievements — reporting format',
      tools: ['search_standards'],
      gatherBrief:
        'Search the standards corpus for what the CHS requires of reporting, measurement, and accountability to affected populations — the commitments on effectiveness, on monitoring outputs against outcomes, and on complaints and feedback.',
      brief:
        'Do NOT write achievements. You have no access to this organisation\'s monitoring data, and inventing outputs for a donor report would be fraud. Instead give the structure the achievements narrative should take: the fields each result statement needs (activity, output with unit, outcome, reference period, data source, and how it was verified), and the CHS commitments that govern how results are measured and reported, by number and with the section reference. Present it as a fill-in template with explicit blanks. End with one sentence stating that every figure entered must come from the organisation\'s own monitoring system and be verifiable against it.',
    },
    {
      id: 'needs',
      heading: 'Needs and gaps',
      tools: ['humanitarian_data', 'crisis_updates'],
      gatherBrief:
        'Get the current needs and funding picture: people in need and targeted, appeal requirements against funding received, and food-security classification where relevant.',
      brief:
        'Quantify the unmet need with a short table — figure, value, reference period, source — and then two or three sentences on what the gap means operationally. Every figure must carry its reference period. Where a figure is unavailable, say so in the row; do not estimate a number to complete the picture, and do not present a figure quoted inside a narrative situation report as an official total.',
    },
    {
      id: 'ask',
      heading: 'The ask',
      tools: ['humanitarian_data', 'search_standards'],
      gatherBrief:
        'Get the funding requirement and shortfall for this response, and the standards that define the minimum service level the ask must fund.',
      brief:
        'State what is being requested and what it would deliver, tying the request to the gap quantified above and to the minimum standard the funding would meet — named, with its section reference. Do not invent a budget figure, a unit cost, or a beneficiary target: if the evidence does not contain the amount, write that the requested amount is to be supplied by the programme team and say what it must be justified against.',
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
