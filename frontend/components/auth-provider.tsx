"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { clearToken, getMe, getToken, type User } from "@/lib/api";

type AuthContextValue = {
  user: User;
  logout: () => void;
};

// A shared "box" that holds the logged-in user for every admin page
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  // The guard: no pass → login page; pass → ask the backend "who am I?"
  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => {
        clearToken();
        router.replace("/login");
      });
  }, [router]);

  const logout = useCallback(() => {
    clearToken();
    toast.success("You've been signed out.");
    router.replace("/login");
  }, [router]);

  // While checking, show a small spinner instead of the page
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>;
}

// Any page can call useAuth() to get the user and the logout function
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
