import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  apiRequest,
  setApiAccessToken,
  setTokenRefresher,
} from '../api/client';

const REFRESH_KEY = 'ecochess_refresh_token';

async function getStoredRefreshToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem(REFRESH_KEY)
      : null;
  }
  return SecureStore.getItemAsync(REFRESH_KEY);
}

async function storeRefreshToken(token: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      if (token) localStorage.setItem(REFRESH_KEY, token);
      else localStorage.removeItem(REFRESH_KEY);
    }
    return;
  }
  if (token) {
    await SecureStore.setItemAsync(REFRESH_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  }
}

export interface UserProfile {
  id: string;
  name: string | null;
  phone: string;
  ageBand: string | null;
  role: string;
  cohortId: string | null;
  lifetimeGreenPoints: number;
  greenPointBalance: number;
  streakCount: number;
  freezesHeld: number;
  rank: {
    tier: number;
    name: string;
    nextTier: { tier: number; name: string; minPoints: number } | null;
  };
}

interface AuthContextValue {
  user: UserProfile | null;
  isLoading: boolean;
  completeOtpLogin: (
    accessToken: string,
    refreshToken: string,
  ) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const res = await apiRequest<UserProfile>('/users/me');
    setUser(res.data);
  }, []);

  const refreshTokens = useCallback(async (): Promise<string | null> => {
    const stored = await getStoredRefreshToken();
    if (!stored) return null;
    try {
      const res = await apiRequest<{
        accessToken: string;
        refreshToken: string;
      }>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken: stored },
        retryOn401: false,
      });
      setApiAccessToken(res.data.accessToken);
      await storeRefreshToken(res.data.refreshToken);
      return res.data.accessToken;
    } catch {
      setApiAccessToken(null);
      await storeRefreshToken(null);
      setUser(null);
      return null;
    }
  }, []);

  useEffect(() => {
    setTokenRefresher(refreshTokens);
    (async () => {
      try {
        const token = await refreshTokens();
        if (token) {
          await refreshProfile();
        }
      } catch {
        // Not signed in
      } finally {
        setIsLoading(false);
      }
    })();
    return () => setTokenRefresher(null);
  }, [refreshProfile, refreshTokens]);

  const completeOtpLogin = useCallback(
    async (accessToken: string, refreshToken: string) => {
      setApiAccessToken(accessToken);
      await storeRefreshToken(refreshToken);
      await refreshProfile();
    },
    [refreshProfile],
  );

  const signOut = useCallback(async () => {
    const stored = await getStoredRefreshToken();
    if (stored) {
      try {
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: { refreshToken: stored },
          retryOn401: false,
        });
      } catch {
        // Ignore network errors on logout
      }
    }
    setApiAccessToken(null);
    await storeRefreshToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, completeOtpLogin, refreshProfile, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
