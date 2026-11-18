'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, tokenStore } from './api';
import type { User } from './types';

interface AuthValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signInWithToken: (token: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const expire = () => setUser(null);
    window.addEventListener('auth:expired', expire);
    if (tokenStore.get()) {
      api.me().then(setUser).catch(() => tokenStore.clear()).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    return () => window.removeEventListener('auth:expired', expire);
  }, []);

  const accept = useCallback((res: { accessToken: string; user: User }) => {
    tokenStore.set(res.accessToken);
    setUser(res.user);
  }, []);

  const signInWithToken = useCallback(async (token: string) => {
    tokenStore.set(token);
    try {
      setUser(await api.me());
    } catch (err) {
      tokenStore.clear();
      throw err;
    }
  }, []);

  const value: AuthValue = {
    user,
    loading,
    signIn: async (email, password) => accept(await api.login(email, password)),
    signUp: async (name, email, password) => accept(await api.register(name, email, password)),
    signInWithToken,
    signOut: () => {
      tokenStore.clear();
      setUser(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
