/**
 * Standard error envelope used for all 4xx and 5xx responses.
 */
export interface ErrorResponse {
  error: string; // human-readable message
  details?: unknown; // optional structured detail, e.g. field-level errors
}
