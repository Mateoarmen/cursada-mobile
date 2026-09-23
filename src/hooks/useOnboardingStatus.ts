import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { catCarrerasDe } from "@/lib/catalog";
import type { Profile } from "@/types/database";

const claveModoManual = (userId: string) => `cursada:onboarding-manual:${userId}`;

export type OnboardingStatus = {
  loading: boolean;
  profile: Profile | null;
  // El usuario todavía no tiene ninguna materia cargada — mismo gate que
  // `!CACHE.materias.length` en runtime.js (ver mostrarOnboardingOCatalogo).
  needsOnboarding: boolean;
  // La universidad del perfil tiene catálogo cargado (cat_carreras_de
  // devuelve al menos una carrera) y todavía no eligió carrera — el wizard
  // se adapta según lo que haya cargado para esa universidad (ver
  // app/onboarding/wizard.tsx).
  eligibleForWizard: boolean;
  refresh: () => Promise<void>;
  // Marca que el usuario eligió "Prefiero cargarlo a mano" (salirAManual en
  // wizard.tsx) — sin esto, alguien con universidad+catálogo pero sin
  // carrera_id seguía siendo eligibleForWizard para siempre: apenas tocaba
  // una tab que no fuera Materias, needsOnboarding lo mandaba de vuelta a
  // /onboarding, que lo reenviaba derecho al wizard de nuevo (loop real,
  // reportado por el usuario). AsyncStorage por userId, no perfil: no hay
  // columna para esto y no hace falta una — sólo importa en este dispositivo
  // mientras needsOnboarding sigue en true (hasta la primera materia real).
  marcarModoManual: () => Promise<void>;
};

export function useOnboardingStatus(userId: string | null | undefined): OnboardingStatus {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [materiasCount, setMateriasCount] = useState(0);
  const [tieneCatalogo, setTieneCatalogo] = useState(false);
  const [modoManual, setModoManual] = useState(false);
  // Para qué userId es el último refresh() terminado. Al cambiar de sesión
  // (login/logout) hay un render en el que `loading` todavía es el false del
  // usuario anterior y materiasCount sigue en 0 — el gate de _layout.tsx
  // leía eso como "necesita onboarding" y rebotaba un instante a una
  // pantalla equivocada. Mientras no coincida, se reporta loading.
  const [cargadoPara, setCargadoPara] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setModoManual(false);
      return;
    }
    AsyncStorage.getItem(claveModoManual(userId))
      .then((v) => setModoManual(v === "1"))
      .catch(() => setModoManual(false));
  }, [userId]);

  const marcarModoManual = useCallback(async () => {
    if (!userId) return;
    setModoManual(true);
    try {
      await AsyncStorage.setItem(claveModoManual(userId), "1");
    } catch {
      // No crítico — en el peor caso vuelve a ofrecerse el wizard.
    }
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      setMateriasCount(0);
      setTieneCatalogo(false);
      setCargadoPara(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [{ data: profileData }, { count }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("materias").select("id", { count: "exact", head: true }),
    ]);
    const nextProfile = (profileData as Profile) ?? null;
    setProfile(nextProfile);
    setMateriasCount(count ?? 0);

    if (nextProfile?.university_id) {
      const carreras = await catCarrerasDe(nextProfile.university_id).catch(() => []);
      setTieneCatalogo(carreras.length > 0);
    } else {
      setTieneCatalogo(false);
    }
    setCargadoPara(userId);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const cargando = loading || cargadoPara !== (userId ?? null);
  const needsOnboarding = !cargando && !!userId && materiasCount === 0;
  // Antes exigía tieneCatalogo siempre, lo que asumía que university_id ya
  // venía seteado del signup. Ahora que universidad se pregunta recién
  // adentro del wizard (ver app/onboarding/wizard.tsx, paso "universidad"),
  // sin universidad todavía hay que entrar igual al wizard — es él quien la
  // va a pedir. Con universidad ya elegida, el criterio de siempre sigue
  // aplicando: con catálogo va al wizard, sin catálogo cae al onboarding
  // genérico (ver el `router.replace("/onboarding")` en wizard.tsx).
  // `!profile.university_other` es necesario: alguien que elige "Otra" dentro
  // del wizard deja university_id en null A PROPÓSITO (no es "todavía no
  // contestó") — sin este chequeo, esa cuenta quedaría eligible para
  // siempre y el wizard la haría elegir universidad en bucle cada vez que
  // vuelve a onboarding/index.tsx. `!modoManual` — ver marcarModoManual.
  // Ya no se exige `!profile.carrera_id`: el wizard guarda universidad y
  // carrera apenas se confirman esos pasos, así que quien cortaba después
  // (sin llegar a confirmar materias) quedaba con carrera_id seteado, dejaba
  // de ser elegible y caía para siempre en el onboarding genérico "crear mi
  // primera materia" — perdiendo todo el catálogo. needsOnboarding ya
  // garantiza que sólo se entra mientras no haya ninguna materia, y el
  // wizard retoma desde el primer paso que falta (ver wizard.tsx).
  const eligibleForWizard = !!profile && !modoManual && !profile.university_other && (!profile.university_id || tieneCatalogo);

  return { loading: cargando, profile, needsOnboarding, eligibleForWizard, refresh, marcarModoManual };
}
