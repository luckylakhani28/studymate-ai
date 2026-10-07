import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const ISSUER = 'studymate-api';
const AUDIENCE = 'studymate-client';
const VERIFY_OPTIONS = { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE };

export function signAccessToken(user) {
  return jwt.sign({ role: user.role }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: String(user._id),
    issuer: ISSUER,
    audience: AUDIENCE,
    expiresIn: env.JWT_ACCESS_TTL,
  });
}

/**
 * Pinning `algorithms` blocks algorithm-confusion attacks ("alg": "none").
 * Rotation: put the new secret in JWT_ACCESS_SECRET and the old one in _PREVIOUS;
 * old tokens keep working until they expire (≤ 15 min), so nobody is logged out.
 */
export function verifyAccessToken(token) {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, VERIFY_OPTIONS);
  } catch (err) {
    const wrongSecret = err instanceof jwt.JsonWebTokenError && err.message === 'invalid signature';
    if (wrongSecret && env.JWT_ACCESS_SECRET_PREVIOUS) {
      return jwt.verify(token, env.JWT_ACCESS_SECRET_PREVIOUS, VERIFY_OPTIONS);
    }
    throw err;
  }
}

/** 256 bits of randomness, URL-safe. */
export const generateRefreshToken = () => randomBytes(32).toString('base64url');

/** Refresh tokens are high-entropy random values, so a fast hash is safe (unlike passwords). */
export const hashToken = (raw) => createHash('sha256').update(raw).digest('hex');
