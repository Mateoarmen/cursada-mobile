import { createContext, useContext, useMemo, type ReactNode } from "react";
import { crearRepoSupabase, useAsistenciaState, type AsistenciaRepo, type AsistenciaState } from "./useAsistencia";

const Ctx = createContext<AsistenciaState | null>(null);

// Una sola instancia de useAsistenciaState compartida entre la pantalla de
// Asistencia, el aviso diario (AsistenciaDiarioGate) y el detalle de
// materia — mismo patrón que OnboardingStatusProvider. `repo` sólo se pasa
// para ejercitar la UI con datos propios (vista previa/tests); en la app
// real alcanza con `userId`.
export function AsistenciaProvider({
  userId,
  repo,
  children,
}: {
  userId: string | null | undefined;
  repo?: AsistenciaRepo | null;
  children: ReactNode;
}) {
  const repoEfectivo = useMemo(() => (repo !== undefined ? repo : userId ? crearRepoSupabase(userId) : null), [repo, userId]);
  const state = useAsistenciaState(repoEfectivo);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useAsistencia(): AsistenciaState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAsistencia debe usarse dentro de AsistenciaProvider");
  return ctx;
}
