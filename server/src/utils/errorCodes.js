export const ErrorCodes = Object.freeze({
  VALIDATION_ERROR: { status: 400, message: 'Request validation failed' },
  INVALID_JSON: { status: 400, message: 'Malformed JSON body' },
  INVALID_ID: { status: 400, message: 'Invalid resource id' },
  UNAUTHORIZED: { status: 401, message: 'Authentication required' },
  FORBIDDEN: { status: 403, message: 'You do not have access to this resource' },
  NOT_FOUND: { status: 404, message: 'Resource not found' },
  CONFLICT: { status: 409, message: 'Resource already exists' },
  PAYLOAD_TOO_LARGE: { status: 413, message: 'Request body too large' },
  RATE_LIMITED: { status: 429, message: 'Too many requests, please try again later' },
  INTERNAL_ERROR: { status: 500, message: 'Internal server error' },
  SERVICE_UNAVAILABLE: { status: 503, message: 'Service temporarily unavailable' },

  // Auth
  EMAIL_TAKEN: { status: 409, message: 'An account with this email already exists' },
  INVALID_CREDENTIALS: { status: 401, message: 'Invalid email or password' },
  TOKEN_EXPIRED: { status: 401, message: 'Access token expired' },
  INVALID_TOKEN: { status: 401, message: 'Invalid access token' },
  INVALID_REFRESH_TOKEN: { status: 401, message: 'Session expired, please log in again' },
  REFRESH_TOKEN_REUSED: {
    status: 401,
    message: 'Session revoked for security reasons, please log in again',
  },
  REFRESH_RACE: { status: 409, message: 'Session was just refreshed in another tab' },

  // Documents
  UNSUPPORTED_FILE: { status: 415, message: 'Only PDF files are supported' },
  FILE_TOO_LARGE: { status: 413, message: 'File is too large' },
  DUPLICATE_DOCUMENT: { status: 409, message: 'This PDF is already in your library' },
  DOCUMENT_LIMIT_REACHED: {
    status: 409,
    message: 'Document limit reached. Delete a document to upload more.',
  },
  ALREADY_PROCESSING: { status: 409, message: 'This document is already being processed' },
  DOCUMENT_NOT_READY: { status: 409, message: 'This document is still being processed' },

  // AI
  QUOTA_EXCEEDED: {
    status: 429,
    message: 'You’ve reached your daily AI limit. It frees up gradually over the next 24 hours.',
  },
  LLM_UNAVAILABLE: {
    status: 503,
    message: 'The AI service is temporarily unavailable. Try again in a moment.',
  },
  AI_OUTPUT_INVALID: { status: 502, message: 'The AI returned an unexpected response. Try again.' },
  AI_OUTPUT_TRUNCATED: { status: 502, message: 'The AI response was cut off before it finished.' },
});
