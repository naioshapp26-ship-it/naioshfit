import React, { createContext, useState, useEffect } from "react";
import { InsertUser } from "@shared/schema";
import { login as authLogin, signup as authSignup, logout as authLogout, getCurrentUser } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { AuthContextType } from "@/hooks/use-auth";
import {
  AppUser,
  GuestPreviewRole,
  clearGuestUser,
  createGuestUser,
  getStoredGuestUser,
  isGuestUser,
  saveGuestUser,
} from "@/lib/guest-utils";

// Create context with a default value matching our AuthContextType
const defaultAuthContext: AuthContextType = {
  user: null,
  loading: false,
  error: null,
  login: async () => { throw new Error("AuthContext not initialized"); },
  signup: async () => { throw new Error("AuthContext not initialized"); },
  logout: async () => { throw new Error("AuthContext not initialized"); },
  updateUser: async () => { throw new Error("AuthContext not initialized"); },
  enterGuestMode: async () => { throw new Error("AuthContext not initialized"); },
  exitGuestMode: () => { throw new Error("AuthContext not initialized"); },
};

export const AuthContext = createContext<AuthContextType>(defaultAuthContext);

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


  // Add a mechanism to refresh user data
  const refreshUser = async () => {
    try {
      const result = await getCurrentUser();
      if (result) {
        setUser(result);
        if (typeof window !== 'undefined') {
          localStorage.setItem('currentUser', JSON.stringify(result));
        }
      }
    } catch (err) {
      console.error('Error refreshing user:', err);
    }
  };

  useEffect(() => {
    // Create a function to load user data
    const loadUser = async () => {
      try {
        setLoading(true);

        const guestUser = getStoredGuestUser();
        if (guestUser) {
          setUser(guestUser);
          return;
        }
        
        // Try to get user from server - this will clear localStorage if not authenticated
        const result = await getCurrentUser();
        
        if (result) {
          // Server says user is authenticated - update context with server data
          setUser(result);
        } else {
          // No authentication - ensure user is null
          setUser(null);
        }
      } catch (err) {
        console.error("Error loading user:", err);
        setError("Failed to load user information");
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      setLoading(true);
      setError(null);
      clearGuestUser();
      const loggedInUser = await authLogin(email, password);
      setUser(loggedInUser);
    } catch (err) {
      console.error("Login error:", err);
      setError("Invalid email or password");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (userData: InsertUser) => {
    try {
      setLoading(true);
      setError(null);
      clearGuestUser();
      const newUser = await authSignup(userData);
      setUser(newUser);
    } catch (err) {
      console.error("Signup error:", err);
      setError("Failed to create account");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);

      if (isGuestUser(user)) {
        clearGuestUser();
        if (typeof window !== 'undefined') {
          localStorage.removeItem('currentUser');
          window.location.href = '/home';
        }
        setUser(null);
        return true;
      }
      
      // Clear localStorage only if in browser
      if (typeof window !== 'undefined') {
        localStorage.removeItem('currentUser');
      }
      
      // Call server logout
      const success = await authLogout();
      
      // Clear user state in context
      setUser(null);
      
      // Explicitly redirect to auth page only if in browser
      if (typeof window !== 'undefined') {
        window.location.href = "/auth";
      }
      
      return success;
    } catch (err) {
      console.error("Logout error:", err);
      setError("Failed to log out");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateUser = async (userData: Partial<AppUser>) => {
    try {
      if (!user) {
        throw new Error("No user logged in");
      }

      if (isGuestUser(user)) {
        throw new Error("Guest users cannot update profile");
      }

      const currentUser = user as AppUser;
      
      setLoading(true);
      const response = await apiRequest("PATCH", `/api/users/${currentUser.id}`, userData);
      const updatedUser = await response.json();
      setUser((prevUser: any) => ({ ...prevUser!, ...updatedUser }));
    } catch (err) {
      console.error("Update user error:", err);
      setError("Failed to update user information");
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const enterGuestMode = async (role: GuestPreviewRole) => {
    const guestUser = createGuestUser(role);
    setError(null);
    setUser(guestUser);

    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentUser');
      saveGuestUser(guestUser);
      window.location.href = role === 'coach' ? '/coach' : '/dashboard';
    }
  };

  const exitGuestMode = () => {
    clearGuestUser();
    setUser(null);
  };

  const contextValue: AuthContextType = {
    user,
    loading,
    error,
    login,
    signup,
    logout,
    updateUser,
    enterGuestMode,
    exitGuestMode,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};
