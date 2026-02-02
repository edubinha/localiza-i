import React, { createContext, useState, useEffect, useCallback } from 'react';

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
  setAdminValidated: (validated: boolean, adminSecret?: string) => void;
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
      console.error('Error loading empresa from session:', error);
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
      sessionStorage.removeItem('localiz_admin_secret');
      setIsAdminValidated(false);
    }
  }, []);

  const setAdminValidated = useCallback((validated: boolean, adminSecret?: string) => {
    setIsAdminValidated(validated);
    if (validated) {
      sessionStorage.setItem(ADMIN_KEY, 'true');
      // Store admin_secret temporarily for authorized operations
      if (adminSecret) {
        sessionStorage.setItem('localiz_admin_secret', adminSecret);
      }
    } else {
      sessionStorage.removeItem(ADMIN_KEY);
      sessionStorage.removeItem('localiz_admin_secret');
    }
  }, []);

  const logout = useCallback(() => {
    setEmpresaState(null);
    setIsAdminValidated(false);
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(ADMIN_KEY);
    sessionStorage.removeItem('localiz_admin_secret');
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
