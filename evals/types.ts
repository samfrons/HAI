/**
 * Shared shapes for the eval harness.
 *
 * The judgment unions deliberately have no "default" member: every enum below
 * has an explicit value for "the judge failed", separate from every value that
 * means "the assistant did well". Nothing in this harness may collapse a
 * missing, malformed, or unsure judgment into a passing one — that collapse is
 * exactly what invalidated the prior prototype's audit (see research/README.md).
 */

export interface Scenario {
  id: string;
  category: string;
  name: string;
  description: string;
  /** The user probe(s) sent to the assistant, in order, as one conversation. */
  seed_instruction: string;
  evaluation_criteria: string[];
  expected_facts?: string[];
  incorrect_claims_to_avoid?: string[];
  safety_dimensions?: string[];
  warning?: string;
}

/* ------------------------------------------------------------------ *
 * Transcripts
 * ------------------------------------------------------------------ */

export interface StreamEvent {
  type: string;
  [key: string]: unknown;
}

export interface ToolInvocation {
  toolCallId: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
  error?: string;
}

export interface Turn {
  probe: string;
  text: string;
  toolCalls: ToolInvocation[];
  /** `data-safety-notice` payloads streamed by the app's PII interception. */
  safetyNotices: unknown[];
  /** Transport, HTTP, or stream-level failures. Non-empty means target_error. */
  errors: string[];
  httpStatus: number;
  durationMs: number;
  /** Raw stream events, kept so a report reader can re-derive everything above. */
  events: StreamEvent[];
}

export interface Transcript {
  scenarioId: string;
  turns: Turn[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  /** True when the app's data-responsibility screen intercepted any turn. */
  interceptionOccurred: boolean;
  /** True when interception is a legitimate outcome for this scenario. */
  interceptionIsAppropriate: boolean;
  failed: boolean;
  errors: string[];
}

/* ------------------------------------------------------------------ *
 * Judgments
 * ------------------------------------------------------------------ */

export type CriterionJudgment = 'met' | 'not_met' | 'uncertain' | 'judge_error';
export type FactJudgment = 'present' | 'absent' | 'contradicted' | 'judge_error';
export type ClaimJudgment = 'avoided' | 'asserted' | 'uncertain' | 'judge_error';

export interface CriterionResult {
  criterion: string;
  judgment: CriterionJudgment;
  evidence: string;
  /** Populated only when judgment is judge_error. */
  error?: string;
  raw?: string;
  attempts: number;
  durationMs: number;
}

export interface FactResult {
  fact: string;
  judgment: FactJudgment;
  evidence: string;
  error?: string;
  raw?: string;
  attempts: number;
  durationMs: number;
}

export interface ClaimResult {
  claim: string;
  judgment: ClaimJudgment;
  evidence: string;
  error?: string;
  raw?: string;
  attempts: number;
  durationMs: number;
}

export type Verdict = 'pass' | 'partial' | 'fail' | 'judge_error' | 'target_error';

export interface ScenarioResult {
  scenarioId: string;
  name: string;
  category: string;
  safetyDimensions: string[];
  verdict: Verdict;
  /** Plain-language reason the verdict came out the way it did. */
  verdictReason: string;
  criteria: CriterionResult[];
  facts: FactResult[];
  avoidedClaims: ClaimResult[];
  interception: {
    occurred: boolean;
    appropriateForScenario: boolean;
    /** True when the app refused a scenario where refusal is not the right call. */
    overRefusal: boolean;
  };
  /**
   * Tool names the assistant actually called, in order. Surfaced in the report
   * because "answered from the model's own memory" and "answered from retrieved
   * standards" are different claims, and the criteria alone cannot tell them
   * apart — a confident unsourced answer can satisfy a rubric.
   */
  toolCallsMade: string[];
  targetDurationMs: number;
  judgeDurationMs: number;
  transcriptPath: string;
}

export interface RunConfig {
  chatUrl: string;
  ollamaBaseUrl: string;
  judgeModel: string;
  /** What the app reports it is running, and what Ollama says actually served. */
  targetModelConfigured: string;
  targetModelObserved: string[];
  judgeModelDigest: string;
  targetModelDigest: string;
  requestTimeoutMs: number;
  judgeNumCtx: number;
  mode: 'smoke' | 'full' | 'custom';
  scenarioIds: string[];
}

export interface RunSummary {
  startedAt: string;
  finishedAt: string;
  wallClockMs: number;
  targetPhaseMs: number;
  judgePhaseMs: number;
  config: RunConfig;
  counts: Record<Verdict, number>;
  results: ScenarioResult[];
}
