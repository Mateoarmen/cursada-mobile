import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelado) return;
        if (!data.session) {
          setSession(null);
          return;
        }
        // getSession() sólo lee el JWT cacheado en el dispositivo — no
        // confirma que el usuario siga existiendo del lado del servidor.
        // Caso real: se borra el usuario a mano desde Supabase mientras el
        // dispositivo todavía tiene la sesión persistida; el JWT no está
        // vencido (no dispara refresh), así que sin este chequeo se cae acá
        // con un session no-nulo pero roto, con el que cada query
        // autenticada más adelante falla — getUser() sí valida contra
        // GoTrue, así que si falla cerramos sesión local para volver a
        // /login en vez de quedar trancados.
        const { error } = await supabase.auth.getUser();
        if (cancelado) return;
        if (error) {
          await supabase.auth.signOut().catch(() => {});
          if (cancelado) return;
          setSession(null);
          return;
        }
        setSession(data.session);
      } catch {
        if (!cancelado) setSession(null);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      cancelado = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  return { session, loading };
}
