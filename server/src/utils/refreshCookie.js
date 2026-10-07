import { env, isProd } from '../config/env.js';

export const REFRESH_COOKIE = 'sm_rt';

const baseOptions = {
  httpOnly: true, // JavaScript can't read it, so XSS can't steal it
  secure: isProd || env.COOKIE_SAMESITE === 'none',
  sameSite: env.COOKIE_SAMESITE,
  path: '/api/v1/auth', // only sent to auth endpoints
};

export const setRefreshCookie = (res, token) =>
  res.cookie(REFRESH_COOKIE, token, {
    ...baseOptions,
    maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000,
  });

export const clearRefreshCookie = (res) => res.clearCookie(REFRESH_COOKIE, baseOptions);
