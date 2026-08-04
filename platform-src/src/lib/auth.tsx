import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Navigate } from "react-router-dom";
import { supabase, configMissing } from "./supabase";

export type Role = "admin" | "parent";

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
}

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(!configMissing);

  useEffect(() => {
    if (configMissing) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setLoading(false);
      return;
    }
    supabase
      .from("profiles")
      .select("id, full_name, role")
      .eq("id", session.user.id)
      .single()
      .then(({ data }) => {
        setProfile((data as Profile) ?? null);
        setLoading(false);
      });
  }, [session]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext);
}

export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-gray-500">Loading…</div>;
  if (!session || !profile) return <Navigate to="/login" replace />;
  if (profile.role !== role)
    return <Navigate to={profile.role === "admin" ? "/admin" : "/parent"} replace />;
  return <>{children}</>;
}
