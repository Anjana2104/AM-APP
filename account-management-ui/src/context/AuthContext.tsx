import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { UserSession, PagePermission } from '../api/authApi';
import * as authApi from '../api/authApi';

const SESSION_KEY = 'eam_user_session';

interface AuthContextValue {
  currentUser: UserSession | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
  /** Returns true if the current user's role grants the given action on the given page */
  hasPermission: (pageId: string, action: 'view' | 'edit' | 'delete') => boolean;
  /** Returns the full permission object for a page */
  getPagePermission: (pageId: string) => PagePermission;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadSession(): UserSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) return JSON.parse(raw) as UserSession;
  } catch { /* ignore */ }
  return null;
}

function saveSession(user: UserSession | null) {
  try {
    if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserSession | null>(() => loadSession());

  const login = useCallback(async (username: string, password: string) => {
    const result = await authApi.login(username, password);
    if (result.ok && result.user) {
      setCurrentUser(result.user);
      saveSession(result.user);
      return { ok: true };
    }
    return { ok: false, error: result.error || 'Login failed' };
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setCurrentUser(null);
    // Clear entire sessionStorage so the next login starts a truly fresh session
    try { sessionStorage.clear(); } catch { /* ignore */ }
  }, []);

  const hasPermission = useCallback((pageId: string, action: 'view' | 'edit' | 'delete'): boolean => {
    if (!currentUser) return false;
    const pagePerm = currentUser.permissions?.[pageId];
    if (!pagePerm) return false;
    return !!pagePerm[action];
  }, [currentUser]);

  const getPagePermission = useCallback((pageId: string): PagePermission => {
    if (!currentUser) return { view: false, edit: false, delete: false };
    return currentUser.permissions?.[pageId] ?? { view: false, edit: false, delete: false };
  }, [currentUser]);

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated: !!currentUser, login, logout, hasPermission, getPagePermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
