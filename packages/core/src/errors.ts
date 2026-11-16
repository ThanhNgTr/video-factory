// One error class for the whole pipeline (roadmap §4.11). The runner decides retry vs stop from `retryable`.
export type StageErrorCode =
  | "provider-transient"
  | "provider-failed"
  | "invalid-output"
  | "missing-reference"
  | "qa-failed"
  | "budget-exceeded"
  | "io";

export class StageError extends Error {
  readonly code: StageErrorCode;
  readonly retryable: boolean;
  readonly details: Record<string, unknown>;
  constructor(
    code: StageErrorCode,
    message: string,
    opts: { retryable?: boolean; details?: Record<string, unknown>; cause?: unknown } = {},
  ) {
    super(message, { cause: opts.cause });
    this.name = "StageError";
    this.code = code;
    this.retryable = opts.retryable ?? false;
    this.details = opts.details ?? {};
  }
}

// Programming errors crash: an invariant the code must guarantee was broken.
export function invariant(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(`invariant violated: ${message}`);
}
