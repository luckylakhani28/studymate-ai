import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AuthContext } from './AuthContext.js';
import { authApi } from './authApi.js';
import { refreshSession, setAccessToken, setSessionExpiredHandler } from '../../api/client.js';

export function AuthProvider({ children }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState({ status: 'loading', user: null });

  const endSession = useCallback(() => {
    setAccessToken(null);
    queryClient.clear(); // never show the previous user's cached data to the next one
    setSession({ status: 'anonymous', user: null });
  }, [queryClient]);

  const startSession = useCallback(({ user, accessToken }) => {
    setAccessToken(accessToken);
    setSession({ status: 'authenticated', user });
  }, []);

  // On page load, the httpOnly refresh cookie is the only proof of a session.
  useEffect(() => {
    setSessionExpiredHandler(endSession);
    let active = true;
    refreshSession()
      .then((user) => active && setSession({ status: 'authenticated', user }))
      .catch(() => active && setSession({ status: 'anonymous', user: null }));
    return () => {
      active = false;
    };
  }, [endSession]);

  const value = useMemo(
    () => ({
      ...session,
      login: async (credentials) => startSession(await authApi.login(credentials)),
      register: async (details) => startSession(await authApi.register(details)),
      logout: async () => {
        await authApi.logout().catch(() => {}); // log out locally even if the network fails
        endSession();
      },
    }),
    [session, startSession, endSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
