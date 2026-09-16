import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ORT_UNIVERSITY_ID } from "@/lib/catalog";
import type { Profile } from "@/types/database";

export type OnboardingStatus = {
  loading: boolean;
  profile: Profile | null;
  // El usuario todavía no tiene ninguna materia cargada — mismo gate que
  // `!CACHE.materias.length` en runtime.js (ver mostrarOnboardingOCatalogo).
  needsOnboarding: boolean;
  // Sólo ORT tiene catálogo cargado y sólo mientras no eligió carrera
  // todavía — mismo criterio que mostrarOnboardingOCatalogo().
  eligibleForWizard: boolean;
  refresh: () => Promise<void>;
};

export function useOnboardingStatus(userId: string | null | undefined): OnboardingStatus {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [materiasCount, setMateriasCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setMateriasCount(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: profileData }, { count }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("materias").select("id", { count: "exact", head: true }),
    ]);
    setProfile((profileData as Profile) ?? null);
    setMateriasCount(count ?? 0);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const needsOnboarding = !loading && !!userId && materiasCount === 0;
  const eligibleForWizard = !!profile && profile.university_id === ORT_UNIVERSITY_ID && !profile.carrera_id;

  return { loading, profile, needsOnboarding, eligibleForWizard, refresh };
}
