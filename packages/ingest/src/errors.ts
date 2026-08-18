/**
 * Ingest failures, expressed so both the server and the SDK can act on them.
 *
 * Every rejection carries three things a caller needs: a stable `code` to
 * branch on, an HTTP `status` to return, and a `retryable` flag. The flag is
 * the important one — a client that retries a rejected project key forever is
 * worse than one that gives up, and a client that gives up on a transient
 * storage error loses a capture the user cannot easily reproduce.
 */

export type IngestErrorCode =
  | "invalid_content_type"
  | "malformed_request"
  | "missing_field"
  | "field_too_long"
  | "invalid_project_key"
  | "origin_not_allowed"
  | "unsupported_schema_version"
  | "attachment_too_large"
  | "payload_too_large"
  | "unsupported_attachment_type"
  | "unexpected_attachment"
  | "storage_failed"
  | "internal_error";

type IngestErrorSpec = {
  status: number;
  /** Whether an identical retry could plausibly succeed. */
  retryable: boolean;
};

/**
 * How each failure should be reported and whether retrying makes sense.
 *
 * Configuration and payload problems are permanent: the same request will fail
 * the same way, so the SDK should surface them to the developer rather than
 * burn the user's bandwidth. Only infrastructure failures are retryable.
 */
const ERROR_SPECS: Record<IngestErrorCode, IngestErrorSpec> = {
  invalid_content_type: { status: 415, retryable: false },
  malformed_request: { status: 400, retryable: false },
  missing_field: { status: 400, retryable: false },
  field_too_long: { status: 400, retryable: false },
  invalid_project_key: { status: 401, retryable: false },
  origin_not_allowed: { status: 403, retryable: false },
  unsupported_schema_version: { status: 400, retryable: false },
  attachment_too_large: { status: 413, retryable: false },
  payload_too_large: { status: 413, retryable: false },
  unsupported_attachment_type: { status: 415, retryable: false },
  unexpected_attachment: { status: 400, retryable: false },
  storage_failed: { status: 502, retryable: true },
  internal_error: { status: 500, retryable: true },
};

/** The JSON body returned for a rejected report. */
export type IngestErrorBody = {
  error: {
    code: IngestErrorCode;
    message: string;
    retryable: boolean;
    /** The specific field or attachment at fault, when there is one. */
    field?: string;
  };
};

export class IngestError extends Error {
  readonly code: IngestErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly field?: string;

  constructor(code: IngestErrorCode, message: string, field?: string) {
    super(message);
    this.name = "IngestError";
    this.code = code;
    this.status = ERROR_SPECS[code].status;
    this.retryable = ERROR_SPECS[code].retryable;
    this.field = field;
  }

  /**
   * Render as the response body.
   *
   * Messages are written for the developer integrating the SDK, not the end
   * user filing the bug — they say what to change, not merely what went wrong.
   */
  toBody(): IngestErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        retryable: this.retryable,
        ...(this.field ? { field: this.field } : {}),
      },
    };
  }
}

/** Whether an unknown thrown value is one of ours. */
export function isIngestError(error: unknown): error is IngestError {
  return error instanceof IngestError;
}
