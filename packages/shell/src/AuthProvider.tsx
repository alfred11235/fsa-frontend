import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

interface User {
  id: number;
  guid: string;
  name: string;
  email: string;
  phone: string;
  companyId: number | null;
  companyTypeId: number | null;
  municipalityId: number | null;
  roleId: number | null;
  roleName: string;
  membershipId: number | null;
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  isAdmin: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function parseJwt(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function parseLong(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return isNaN(n) ? null : n;
}

function buildUser(claims: Record<string, unknown>): User {
  const permissions = (Array.isArray(claims.Permission) ? claims.Permission : []) as string[];
  return {
    id: parseLong(claims.sub) ?? 0,
    guid: (claims.guid as string) ?? '',
    name: (claims.name as string) ?? '',
    email: (claims.email as string) ?? '',
    phone: (claims.phone as string) ?? '',
    companyId: parseLong(claims.CompanyId),
    companyTypeId: parseLong(claims.CompanyTypeId),
    municipalityId: parseLong(claims.MunicipalityId),
    roleId: parseLong(claims.RoleId),
    roleName: (claims.RoleName as string) ?? '',
    membershipId: parseLong(claims.MembershipId),
    permissions,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('fsa_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const claims = parseJwt(token);
      if (claims) {
        const exp = claims.exp as number | undefined;
        if (exp && exp * 1000 < Date.now()) {
          localStorage.removeItem('fsa_token');
          setToken(null);
          setUser(null);
        } else {
          setUser(buildUser(claims));
        }
      }
    } else {
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
    }
    setIsLoading(false);
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await axios.post('/api/auth/login', { email, password });
    const jwt = res.data.token;
    localStorage.setItem('fsa_token', jwt);
    setToken(jwt);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('fsa_token');
    setToken(null);
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (permission: string) => user?.permissions.includes(permission) ?? false,
    [user]
  );

  const isAdmin = useCallback(
    () => hasPermission('Permissions.Admin.IsAdmin'),
    [hasPermission]
  );

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, isLoading, login, logout, hasPermission, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}
