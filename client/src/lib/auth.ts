import { apiRequest } from "./queryClient";
import { User, InsertUser } from "@shared/schema";
import { clearGuestUser, getStoredGuestUser } from "@/lib/guest-utils";

export async function login(username: string, password: string): Promise<User> {
  clearGuestUser();
  const response = await apiRequest("POST", "/api/auth/login", { username, password });
  const userData = await response.json();
  
  // Store user data in localStorage for persistence
  localStorage.setItem('currentUser', JSON.stringify(userData));
  
  return userData;
}

export async function signup(userData: InsertUser): Promise<User> {
  try {
    clearGuestUser();
    const response = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }

    const createdUser = await response.json();
    localStorage.setItem('currentUser', JSON.stringify(createdUser));
    return createdUser;
  } catch (error) {
    console.error('Signup error details:', error);
    throw error;
  }
}

export async function logout(): Promise<boolean> {
  try {
    // First clear any localStorage/sessionStorage immediately
    clearGuestUser();
    localStorage.removeItem('currentUser');
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    
    // Call the server logout endpoint - don't wait for response to avoid hanging
    fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
    }).catch(error => {
      console.error('Server logout error (continuing anyway):', error);
    });
    
    // Immediate redirect without waiting - this ensures logout works even if server is slow/failing
    window.location.href = "/auth";
    
    return true;
  } catch (error) {
    console.error("Logout error:", error);
    
    // Force redirect even on error
    window.location.href = "/auth";
    
    return false;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const guest = getStoredGuestUser();
    if (guest) {
      return guest as unknown as User;
    }

    // Try to fetch from server - no fallback headers, require proper authentication
    const response = await fetch("/api/auth/me", {
      credentials: "include"
    });

    if (response.ok) {
      const userData = await response.json();
      
      // Check if the response indicates authentication failure
      if (userData.authenticated === false) {
        // Server says not authenticated - clear any stored data and return null
        localStorage.removeItem('currentUser');
        localStorage.removeItem('user');
        sessionStorage.removeItem('user');
        return null;
      }
      
      // Valid user data from server
      localStorage.setItem('currentUser', JSON.stringify(userData));
      return userData;
    } 
    
    // Server responded with error - user is not authenticated
    localStorage.removeItem('currentUser');
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    return null;
  } catch (error) {
    console.error("Error fetching current user:", error);
    // Network error - clear stored data and require login
    localStorage.removeItem('currentUser');
    localStorage.removeItem('user');
    sessionStorage.removeItem('user');
    return null;
  }
}
