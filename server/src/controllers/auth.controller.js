import * as authService from '../services/auth.service.js';
import { ok, noContent } from '../utils/apiResponse.js';
import { REFRESH_COOKIE, setRefreshCookie, clearRefreshCookie } from '../utils/refreshCookie.js';

const clientMeta = (req) => ({ userAgent: req.get('user-agent') ?? null, ip: req.ip ?? null });

const respondWithSession = (res, session, status = 200) => {
  setRefreshCookie(res, session.refreshToken);
  ok(res, { user: session.user, accessToken: session.accessToken }, { status });
};

export async function register(req, res) {
  respondWithSession(res, await authService.register(req.validated.body, clientMeta(req)), 201);
}

export async function login(req, res) {
  respondWithSession(res, await authService.login(req.validated.body, clientMeta(req)));
}

export async function refresh(req, res) {
  try {
    respondWithSession(
      res,
      await authService.refresh(req.cookies[REFRESH_COOKIE], clientMeta(req)),
    );
  } catch (err) {
    // Clearing on a race would delete the cookie the winning tab just received.
    if (err.code !== 'REFRESH_RACE') clearRefreshCookie(res);
    throw err;
  }
}

export async function logout(req, res) {
  await authService.logout(req.cookies[REFRESH_COOKIE]);
  clearRefreshCookie(res);
  noContent(res);
}

export async function logoutAll(req, res) {
  await authService.logoutAll(req.user.id);
  clearRefreshCookie(res);
  noContent(res);
}

export async function me(req, res) {
  ok(res, { user: await authService.getMe(req.user.id) });
}
