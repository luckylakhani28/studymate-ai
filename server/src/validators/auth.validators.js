import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email('Invalid email').max(254));

const newPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  // bcrypt silently ignores bytes beyond 72 — reject instead of truncating.
  .refine((v) => Buffer.byteLength(v, 'utf8') <= 72, 'Password is too long')
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Password must contain a letter and a number');

export const registerSchema = {
  body: z.strictObject({
    name: z.string().trim().min(1, 'Name is required').max(80),
    email,
    password: newPassword,
  }),
};

export const loginSchema = {
  // No policy checks on login: the policy may change, and old accounts must still sign in.
  body: z.strictObject({ email, password: z.string().min(1).max(200) }),
};
