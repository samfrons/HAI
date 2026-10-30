/**
 * Country situation brief.
 *
 * The section layout is ported from `situation.py`'s `country_brief` on the
 * platform-features branch — hazards and alerts, context indicators, datasets,
 * narrative reports, standards guidance, and a trailing block naming every
 * source that failed. What is carried over is the shape and the discipline; the
 * mechanism is different, because that version assembled a fixed dict from
 * fixed connectors, and this one lets a model choose queries within a section's
 * declared tool subset and then checks what it wrote.
 *
 * The ordering is not arbitrary. It is the order a coordinator reads in: what
 * is happening, what it means for people, what it will cost, what the standards
 * require, and what you should not trust. The funding section sits before the
 * guidance section for the same reason it does in an HNO — the gap is the thing
 * a brief exists to make visible, and the guidance is what you do about it.
 */

import type { WorkflowDefinition } from '../types';

export const situationBrief: WorkflowDefinition = {
  id: 'situation-brief',
  title: 'Situation brief',
  subjectKind: 'country',
  description:
    'A country situation brief: hazards, needs and figures, funding, and the standards that apply — every figure carrying its source and reference period.',
  sections: [
    {
      id: 'overview',
      heading: 'Overview',
      tools: ['crisis_updates', 'hazards_context'],
      gatherBrief:
        'Get the current state of the emergency: recent situation reports, and the country context baseline (population, and any active hazard alerts).',
      brief:
        'Open with what is happening in the country now and why it matters humanitarianly. Three or four sentences of prose, no list. Name the drivers of the crisis in humanitarian terms — displacement, conflict, hazard, epidemic — without characterising parties to a conflict or assigning blame.',
    },
    {
      id: 'hazards',
      heading: 'Hazards and alerts',
      tools: ['hazards_context', 'crisis_updates'],
      gatherBrief:
        'Get the live multi-hazard picture for this country: active disaster alerts with their severity, recent significant seismic events, and any hazard named in recent reporting.',
      brief:
        'List the active hazards and alerts, each with its severity level, event type, and date. If there are no active alerts, say so plainly in one line — an absence of alerts is a finding, not an empty section. Do not infer a hazard from the country\'s general reputation for one.',
    },
    {
      id: 'needs',
      heading: 'Humanitarian needs and figures',
      tools: ['humanitarian_data', 'crisis_updates'],
      gatherBrief:
        'Get the country caseload figures: baseline population, people in need and people targeted by sector, and IPC acute food insecurity phase classifications.',
      brief:
        'Present the caseload as a compact markdown table: figure, value, reference period, source. Population, people in need, people targeted, and food-security phase where each is available. Report every figure in aggregate only. If a figure was not returned, give the row and write "not available" in it rather than omitting the row — a missing line reads as a figure that was not looked for.',
    },
    {
      id: 'funding',
      heading: 'Funding',
      tools: ['humanitarian_data', 'hazards_context'],
      gatherBrief:
        'Get appeal requirements and funding received for this country, and any active response plan for the current year.',
      brief:
        'State the appeal requirement, the amount funded, the resulting gap, and the reference period, with the source for each. Compute the gap and the funded percentage only from figures that are actually in the evidence; if either side of the subtraction is missing, say the gap cannot be calculated rather than estimating one.',
    },
    {
      id: 'guidance',
      heading: 'Standards-relevant guidance',
      tools: ['search_standards'],
      gatherBrief:
        'Search the standards corpus for the minimum standards and commitments that bear on the needs above — the relevant Sphere technical chapter, and the CHS commitments on participation, complaints, and coordination.',
      brief:
        'Give three to five operational points, each tied to a named standard or commitment and its section reference. Name frameworks rather than paraphrasing them: the Sphere standard by name, the CHS commitment by number. Flag the protection dimension of at least one technical point — a WASH or shelter decision is a protection decision. This is guidance on what the standards require, not a recommendation about a specific operation.',
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
