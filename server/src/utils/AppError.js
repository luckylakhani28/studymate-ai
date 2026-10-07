import { ErrorCodes } from './errorCodes.js';

export class AppError extends Error {
  /**
   * @param {keyof typeof ErrorCodes} code
   * @param {{ message?: string, details?: unknown, status?: number, cause?: unknown }} [opts]
   */
  constructor(code, { message, details, status, cause } = {}) {
    const known = ErrorCodes[code];
    const def = known ?? ErrorCodes.INTERNAL_ERROR;
    super(message ?? def.message, { cause });
    this.name = 'AppError';
    this.code = known ? code : 'INTERNAL_ERROR';
    this.status = status ?? def.status;
    this.details = details;
  }
}
