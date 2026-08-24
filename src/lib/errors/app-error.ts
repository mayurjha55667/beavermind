export type ErrorCode =
  | "INVALID_INPUT"
  | "TRANSCRIPT_TOO_LARGE"
  | "TRANSCRIPT_FORMAT_INVALID"
  | "EVALUATION_NOT_FOUND"
  | "EVIDENCE_VALIDATION_FAILED"
  | "SCORING_VALIDATION_FAILED"
  | "NARRATIVE_VALIDATION_FAILED"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_FAILURE"
  | "DATABASE_FAILURE"
  | "WORKFLOW_START_FAILED"
  | "INTERNAL_ERROR";

const PUBLIC_MESSAGES: Record<ErrorCode, string> = {
  INVALID_INPUT: "The submitted evaluation is not valid. Check the call type and transcript.",
  TRANSCRIPT_TOO_LARGE: "The transcript is larger than the supported 100,000-character limit.",
  TRANSCRIPT_FORMAT_INVALID:
    "The transcript must contain one speaking turn per line in the form [Speaker]: text.",
  EVALUATION_NOT_FOUND: "This evaluation could not be found.",
  EVIDENCE_VALIDATION_FAILED:
    "We could not verify the extracted evidence against the transcript after a retry.",
  SCORING_VALIDATION_FAILED:
    "The calculated scores did not satisfy the rubric's deterministic rules.",
  NARRATIVE_VALIDATION_FAILED:
    "The report narrative could not be validated against the verified result.",
  PROVIDER_TIMEOUT: "The evaluation provider timed out. The run can be retried safely.",
  PROVIDER_FAILURE: "The evaluation provider was unavailable after bounded retries.",
  DATABASE_FAILURE: "The evaluation could not be persisted safely.",
  WORKFLOW_START_FAILED: "The evaluation was saved, but background processing could not start.",
  INTERNAL_ERROR: "The evaluation failed unexpectedly. No partial result was published.",
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly publicMessage: string;
  readonly details?: unknown;
  readonly retryable: boolean;

  constructor(
    code: ErrorCode,
    options: { cause?: unknown; details?: unknown; message?: string; retryable?: boolean } = {},
  ) {
    super(options.message ?? PUBLIC_MESSAGES[code], { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.publicMessage = PUBLIC_MESSAGES[code];
    this.details = options.details;
    this.retryable = options.retryable ?? false;
  }
}

export function publicMessageForCode(code: ErrorCode): string {
  return PUBLIC_MESSAGES[code];
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError("INTERNAL_ERROR", { cause: error });
}

export function safeDiagnostic(error: unknown): Record<string, unknown> {
  const appError = toAppError(error);
  return {
    name: appError.name,
    code: appError.code,
    message: appError.message,
    details: appError.details ?? null,
  };
}
