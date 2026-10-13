import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authService } from '../services';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: any) => Promise<User>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  isAdmin: boolean;
  isEmployee: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const currentUser = await authService.getMe();
        setUser(currentUser);
      } catch {
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    initAuth();
  }, []);

  const login = async (credentials: any) => {
    const result = await authService.login(credentials);
    setUser(result.user);
    return result.user;
  };

  const logout = async () => {
    try {
      await authService.logout();
    } finally {
      setUser(null);
      window.location.href = '/login';
    }
  };

  const updateUser = (updated: User) => {
    setUser(updated);
  };

  const isAdmin = user?.role === 'ADMIN';
  const isEmployee = user?.role === 'EMPLOYEE';

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        updateUser,
        isAdmin,
        isEmployee,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

