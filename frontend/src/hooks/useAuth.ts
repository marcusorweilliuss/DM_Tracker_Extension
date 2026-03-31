import { useState, useEffect } from 'react';
import { AuthState } from '../types';

export function useAuth() {
  const [auth, setAuth] = useState<AuthState | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('auth');
    if (stored) {
      setAuth(JSON.parse(stored));
    }
  }, []);

  const login = (data: AuthState) => {
    localStorage.setItem('auth', JSON.stringify(data));
    setAuth(data);
  };

  const logout = () => {
    localStorage.removeItem('auth');
    setAuth(null);
  };

  return { auth, login, logout, isLoggedIn: !!auth };
}
