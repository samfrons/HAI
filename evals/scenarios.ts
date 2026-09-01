/**
 * Loading and classifying the 26 scenarios in petri/seeds/.
 *
 * The scenario file is reused unchanged from the archived prototype. Its design
 * was never the problem — the auditor that ran it was (research/README.md). So
 * nothing here edits criteria, adds hints, or reweights anything: the harness
 * reads the file and reports against it as written.
 */

import { readFileSync } from 'node:fs';

import { SCENARIOS_PATH } from './config.ts';
import type { Scenario } from './types.ts';

interface ScenarioFile {
  scenarios: Scenario[];
  metadata?: Record<string, unknown>;
}

export function loadScenarios(): Scenario[] {
  const parsed = JSON.parse(readFileSync(SCENARIOS_PATH, 'utf8')) as ScenarioFile;
  if (!Array.isArray(parsed.scenarios) || parsed.scenarios.length === 0) {
    throw new Error(`No scenarios found in ${SCENARIOS_PATH}`);
  }
  return parsed.scenarios;
}

/**
 * Whether the app's data-responsibility screen firing is a *correct* outcome
 * for this scenario rather than an over-refusal.
 *
 * Derived from what the scenario declares about itself — its category and its
 * safety dimensions — not from a hardcoded list of ids. A list would have to be
 * edited every time a scenario is added, and the edit would be invisible in the
 * report; a derivation is a stated rule that a reader can check against the
 * scenario file. Any scenario that probes handling of personal data is one
 * where "I will not process this, and here is why" can be the right answer.
 */
export function interceptionIsAppropriate(scenario: Scenario): boolean {
  const dimensions = scenario.safety_dimensions ?? [];
  return (
    scenario.category === 'safety_security' ||
    dimensions.includes('privacy') ||
    dimensions.includes('security')
  );
}

/**
 * The smoke set: one standards-grounding scenario, one deception/sycophancy
 * scenario, one beneficiary-data-protection scenario. Chosen to exercise three
 * different code paths (retrieval, refusal-under-pressure, PII screening) in
 * about forty minutes rather than the several hours a full run costs.
 */
export const SMOKE_SCENARIO_IDS = [
  'fews_net_knowledge_001',
  'deception_test_001',
  'data_protection_001',
];

export function selectScenarios(
  all: Scenario[],
  options: { smoke?: boolean; only?: string[] },
): Scenario[] {
  if (options.only?.length) {
    const wanted = new Set(options.only);
    const found = all.filter((scenario) => wanted.has(scenario.id));
    const missing = options.only.filter((id) => !all.some((s) => s.id === id));
    if (missing.length) throw new Error(`Unknown scenario id(s): ${missing.join(', ')}`);
    return found;
  }
  if (options.smoke) {
    return SMOKE_SCENARIO_IDS.map((id) => {
      const scenario = all.find((s) => s.id === id);
      if (!scenario) throw new Error(`Smoke scenario ${id} is missing from the seed file`);
      return scenario;
    });
  }
  return all;
}

/** The probes sent for a scenario, as one conversation. */
export function probesFor(scenario: Scenario): string[] {
  return [scenario.seed_instruction];
}
