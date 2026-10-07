import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { User, RefreshToken } from '../models/index.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';
import { signAccessToken, generateRefreshToken, hashToken } from '../utils/tokens.js';

const REFRESH_TTL_MS = env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;
const ROTATION_GRACE_MS = 10_000;

// Compared against when the email doesn't exist, so response timing doesn't reveal registered emails.
const DUMMY_HASH = bcrypt.hashSync('timing-equalizer-not-a-real-password', env.BCRYPT_ROUNDS);

async function createRefreshToken({ userId, familyId, meta, raw = generateRefreshToken() }) {
  await RefreshToken.create({
    userId,
    familyId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    userAgent: meta.userAgent,
    ip: meta.ip,
  });
  return raw;
}

async function startSession(user, meta) {
  const refreshToken = await createRefreshToken({ userId: user._id, familyId: randomUUID(), meta });
  return { user, accessToken: signAccessToken(user), refreshToken };
}

export async function register({ name, email, password }, meta) {
  const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);
  let user;
  try {
    user = await User.create({ name, email, passwordHash });
  } catch (err) {
    if (err?.code === 11000) throw new AppError('EMAIL_TAKEN');
    throw err;
  }
  return startSession(user, meta);
}

export async function login({ email, password }, meta) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new AppError('INVALID_CREDENTIALS');

  user.lastLoginAt = new Date();
  await user.save();
  return startSession(user, meta);
}

export async function refresh(rawToken, meta) {
  if (!rawToken) throw new AppError('INVALID_REFRESH_TOKEN');

  const now = new Date();
  const nextRaw = generateRefreshToken();

  // Atomic claim: revoke-and-link in ONE operation, so two concurrent requests can never
  // both rotate the same token (no forked families).
  const current = await RefreshToken.findOneAndUpdate(
    { tokenHash: hashToken(rawToken), revokedAt: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now, replacedByHash: hashToken(nextRaw) } },
  );
  if (!current) return rejectInvalidRefresh(hashToken(rawToken), now);

  const user = await User.findById(current.userId);
  if (!user) throw new AppError('INVALID_REFRESH_TOKEN');

  await createRefreshToken({ userId: user._id, familyId: current.familyId, meta, raw: nextRaw });
  return { user, accessToken: signAccessToken(user), refreshToken: nextRaw };
}

async function rejectInvalidRefresh(tokenHash, now) {
  const existing = await RefreshToken.findOne({ tokenHash });
  if (!existing || existing.expiresAt <= now) throw new AppError('INVALID_REFRESH_TOKEN');

  // The token is known but already revoked.
  const benignRace = existing.replacedByHash && now - existing.revokedAt < ROTATION_GRACE_MS;
  if (benignRace) throw new AppError('REFRESH_RACE'); // another tab just rotated it; keep its cookie

  // Replay of an old token → assume theft; kill every token from that login.
  await RefreshToken.updateMany(
    { familyId: existing.familyId, revokedAt: null },
    { $set: { revokedAt: now } },
  );
  logger.warn(
    { userId: existing.userId, familyId: existing.familyId },
    'Refresh token reuse detected',
  );
  throw new AppError('REFRESH_TOKEN_REUSED');
}

export async function logout(rawToken) {
  if (!rawToken) return;
  const token = await RefreshToken.findOne({ tokenHash: hashToken(rawToken) });
  if (!token) return;
  await RefreshToken.updateMany(
    { familyId: token.familyId, revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
}

/** Revokes every refresh token for the user: all devices must log in again once their access token expires. */
export async function logoutAll(userId) {
  await RefreshToken.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function getMe(userId) {
  const user = await User.findById(userId);
  if (!user) throw new AppError('UNAUTHORIZED');
  return user;
}
