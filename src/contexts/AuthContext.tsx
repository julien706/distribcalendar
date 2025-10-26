import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const DEFAULT_AUTH_CODE = "1234"; // Code PIN par défaut
const AUTH_CODE_STORAGE_KEY = "app_auth_code";
const AUTH_STORAGE_KEY = "app_authenticated";

type AuthContextType = {
  isAuthenticated: boolean;
  login: (code: string) => boolean;
  logout: () => void;
  changeCode: (oldCode: string, newCode: string) => boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored === "true") {
      setIsAuthenticated(true);
    }
    // Initialize code if not set
    if (!localStorage.getItem(AUTH_CODE_STORAGE_KEY)) {
      localStorage.setItem(AUTH_CODE_STORAGE_KEY, DEFAULT_AUTH_CODE);
    }
  }, []);

  const getStoredCode = () => {
    return localStorage.getItem(AUTH_CODE_STORAGE_KEY) || DEFAULT_AUTH_CODE;
  };

  const login = (code: string) => {
    if (code === getStoredCode()) {
      setIsAuthenticated(true);
      localStorage.setItem(AUTH_STORAGE_KEY, "true");
      return true;
    }
    return false;
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const changeCode = (oldCode: string, newCode: string) => {
    if (oldCode === getStoredCode()) {
      localStorage.setItem(AUTH_CODE_STORAGE_KEY, newCode);
      return true;
    }
    return false;
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout, changeCode }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
