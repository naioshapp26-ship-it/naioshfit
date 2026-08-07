import { useContext } from "react";
import { AuthContext } from "@/context/AuthContext";
import { InsertUser } from "@shared/schema";
import { AppUser, GuestPreviewRole } from "@/lib/guest-utils";

export type AuthContextType = {
  user: AppUser | null;
  loading: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  signup: (userData: InsertUser) => Promise<void>;
  logout: () => Promise<boolean | void>;
  updateUser: (userData: Partial<AppUser>) => Promise<void>;
  enterGuestMode: (role: GuestPreviewRole) => Promise<void>;
  exitGuestMode: () => void;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  return context;
};
