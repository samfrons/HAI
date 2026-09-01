/**
 * The deliverable templates HAI offers, keyed by the id the client sends.
 *
 * Kept free of server-only imports so the template picker can read titles and
 * descriptions straight from the definitions rather than duplicating them in
 * the UI — a card that describes a workflow differently from the workflow is a
 * card that will drift.
 */

import type { WorkflowDefinition } from '../types';
import { donorReportSection } from './donor-report-section';
import { situationBrief } from './situation-brief';

export const WORKFLOWS = {
  'situation-brief': situationBrief,
  'donor-report-section': donorReportSection,
} as const satisfies Record<string, WorkflowDefinition>;

export type WorkflowId = keyof typeof WORKFLOWS;

export const WORKFLOW_IDS = Object.keys(WORKFLOWS) as WorkflowId[];

export function isWorkflowId(value: string): value is WorkflowId {
  return Object.prototype.hasOwnProperty.call(WORKFLOWS, value);
}

export function getWorkflow(id: WorkflowId): WorkflowDefinition {
  return WORKFLOWS[id];
}

export { donorReportSection, situationBrief };
