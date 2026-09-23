// Overlay global de tour guiado (spotlight en vivo, sólo ORT — ver
// app/onboarding/wizard.tsx confirmar()). Vive por encima del Stack (ver
// app/_layout.tsx) para poder resaltar elementos reales en cualquier tab
// sin necesitar una ruta propia. Dispara una única vez por cuenta: nunca se
// vuelve a entrar al wizard una vez que existe alguna materia (mismo gate
// que needsOnboarding), así que terminar/saltar el tour no necesita su
// propio flag persistido — simplemente navega a progreso-anterior.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { router } from "expo-router";
import type { View } from "react-native";

export type TourStep = { id: string; titulo: string; texto: string };
export type TourRect = { x: number; y: number; width: number; height: number };

// Guión v1 del tour guiado (sólo ORT, ver app/onboarding/wizard.tsx
// confirmar()) — los ids deben coincidir con los useTourTarget(id) marcados
// en app/(tabs)/index.tsx y app/(tabs)/_layout.tsx. Vive acá (no en
// wizard.tsx) para que app/perfil.tsx pueda reusarlo al ofrecer "Ver el
// tour guiado" de nuevo, sin importar de un archivo de ruta.
export const PASOS_TOUR: TourStep[] = [
  { id: "progreso-semestre", titulo: "Tu progreso del semestre", texto: "Acá ves tu promedio y cómo viene cada materia — apenas cargues una nota, esto se actualiza solo." },
  { id: "asistencia-boton", titulo: "Asistencia", texto: "Todos los días que tuviste clase te lo vamos a preguntar acá — un toque y listo, sin planillas aparte." },
  { id: "tab-materias", titulo: "Materias", texto: "Cada materia con su horario, notas y evaluaciones — tocá cualquiera para ver el detalle." },
  { id: "tab-horario", titulo: "Horario", texto: "Tu semana completa de un vistazo, con todas tus materias ya ubicadas." },
];

type TourApi = {
  activo: boolean;
  pasoIdx: number;
  pasos: TourStep[];
  iniciar: (pasos: TourStep[], semestresParam: string) => void;
  saltar: () => void;
  siguiente: () => void;
  anterior: () => void;
  registrarRef: (id: string, ref: RefObject<View | null>) => void;
  desregistrarRef: (id: string) => void;
  obtenerRef: (id: string) => RefObject<View | null> | undefined;
};

const Ctx = createContext<TourApi | null>(null);

export function TourProvider({ hasSession, children }: { hasSession: boolean; children: ReactNode }) {
  const [activo, setActivo] = useState(false);
  const [pasoIdx, setPasoIdx] = useState(0);
  const [pasos, setPasos] = useState<TourStep[]>([]);
  const semestresRef = useRef("[]");
  const refs = useRef(new Map<string, RefObject<View | null>>());

  // El provider vive para toda la vida de la app (nunca se desmonta), así
  // que "activo" quedaba pegado si alguien cerraba sesión a mitad de tour
  // — el overlay no sabe nada de sesión ni de pantalla y seguía dibujándose
  // arriba de /intro o /login (bug real reportado). Cortar acá.
  useEffect(() => {
    if (!hasSession) setActivo(false);
  }, [hasSession]);

  const terminar = useCallback(() => {
    setActivo(false);
    router.replace({ pathname: "/onboarding/progreso-anterior", params: { semestres: semestresRef.current } });
  }, []);

  const iniciar = useCallback((nuevosPasos: TourStep[], semestresParam: string) => {
    semestresRef.current = semestresParam;
    setPasos(nuevosPasos);
    setPasoIdx(0);
    setActivo(true);
  }, []);

  const siguiente = useCallback(() => {
    setPasoIdx((i) => {
      if (i + 1 >= pasos.length) {
        terminar();
        return i;
      }
      return i + 1;
    });
  }, [pasos.length, terminar]);

  const anterior = useCallback(() => setPasoIdx((i) => Math.max(0, i - 1)), []);
  const registrarRef = useCallback((id: string, ref: RefObject<View | null>) => {
    refs.current.set(id, ref);
  }, []);
  const desregistrarRef = useCallback((id: string) => {
    refs.current.delete(id);
  }, []);
  const obtenerRef = useCallback((id: string) => refs.current.get(id), []);

  const value = useMemo<TourApi>(
    () => ({ activo, pasoIdx, pasos, iniciar, saltar: terminar, siguiente, anterior, registrarRef, desregistrarRef, obtenerRef }),
    [activo, pasoIdx, pasos, iniciar, terminar, siguiente, anterior, registrarRef, desregistrarRef, obtenerRef]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTourContext(): TourApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useTourContext debe usarse dentro de TourProvider");
  return ctx;
}

// Un elemento real se vuelve target posible del tour registrando su ref —
// la medición (measureInWindow) la hace TourOverlay on-demand por cada
// paso, no acá, para no medir nada mientras el tour no está activo.
export function useTourTarget(id: string): RefObject<View | null> {
  const tour = useTourContext();
  const ref = useRef<View>(null);
  useEffect(() => {
    tour.registrarRef(id, ref);
    return () => tour.desregistrarRef(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return ref;
}
