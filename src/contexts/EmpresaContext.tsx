import React, { createContext, useState, useEffect, useCallback } from 'react';
import { devLog } from '@/lib/logger';

export interface Empresa {
  id: string;
  nome: string;
  access_key: string;
  google_sheets_url: string | null;
  is_active: boolean;
}

interface EmpresaContextType {
  empresa: Empresa | null;
  isLoading: boolean;
  isAdminValidated: boolean;
  setEmpresa: (empresa: Empresa | null) => void;
  setAdminValidated: (validated: boolean) => void;
  logout: () => void;
}

export const EmpresaContext = createContext<EmpresaContextType | undefined>(undefined);

const SESSION_KEY = 'localiz_empresa';
const ADMIN_KEY = 'localiz_admin_validated';

export function EmpresaProvider({ children }: { children: React.ReactNode }) {
  const [empresa, setEmpresaState] = useState<Empresa | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdminValidated, setIsAdminValidated] = useState(false);

  // Load from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setEmpresaState(parsed);
      }
      const adminStored = sessionStorage.getItem(ADMIN_KEY);
      if (adminStored === 'true') {
        setIsAdminValidated(true);
      }
    } catch (error) {
      devLog.error('Error loading empresa from session:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setEmpresa = useCallback((newEmpresa: Empresa | null) => {
    setEmpresaState(newEmpresa);
    if (newEmpresa) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(newEmpresa));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(ADMIN_KEY);
      setIsAdminValidated(false);
    }
  }, []);

  const setAdminValidated = useCallback((validated: boolean) => {
    setIsAdminValidated(validated);
    if (validated) {
      sessionStorage.setItem(ADMIN_KEY, 'true');
      // Do NOT store admin_secret in sessionStorage for security
      // Sensitive operations will require re-authentication
    } else {
      sessionStorage.removeItem(ADMIN_KEY);
    }
  }, []);

  const logout = useCallback(() => {
    setEmpresaState(null);
    setIsAdminValidated(false);
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(ADMIN_KEY);
  }, []);

  return (
    <EmpresaContext.Provider
      value={{
        empresa,
        isLoading,
        isAdminValidated,
        setEmpresa,
        setAdminValidated,
        logout,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  );
}
