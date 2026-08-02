import React, { createContext, useContext, useState, useCallback } from 'react';
import { CREDENTIALS, ORGS } from '../data/mock';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('ib_user')); } catch { return null; }
  });

  const login = useCallback((username, password, orgId) => {
    const found = CREDENTIALS.find(c => c.user === username && c.pass === password);
    if (!found) return false;
    const org = ORGS.find(o => o.id === orgId) || ORGS[0];
    const userData = { ...found, org };
    setUser(userData);
    sessionStorage.setItem('ib_user', JSON.stringify(userData));
    return true;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem('ib_user');
  }, []);

  const switchOrg = useCallback((orgId) => {
    if (!user) return;
    const org = ORGS.find(o => o.id === orgId) || ORGS[0];
    const updated = { ...user, org };
    setUser(updated);
    sessionStorage.setItem('ib_user', JSON.stringify(updated));
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, switchOrg }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
