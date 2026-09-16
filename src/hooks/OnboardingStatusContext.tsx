import { createContext, useContext, type ReactNode } from "react";
import { useOnboardingStatus, type OnboardingStatus } from "./useOnboardingStatus";

const Ctx = createContext<OnboardingStatus | null>(null);

// Una sola instancia de useOnboardingStatus compartida entre el gate de
// _layout.tsx y las pantallas de onboarding — así, cuando el wizard termina
// de crear materias, puede llamar a refresh() y el gate se entera en el
// mismo render (sin esto, cada pantalla tendría su propia copia del
// conteo de materias y _layout.tsx seguiría creyendo que sigue en 0,
// rebotando de vuelta a /onboarding).
export function OnboardingStatusProvider({ userId, children }: { userId: string | null | undefined; children: ReactNode }) {
  const status = useOnboardingStatus(userId);
  return <Ctx.Provider value={status}>{children}</Ctx.Provider>;
}

export function useOnboardingStatusContext(): OnboardingStatus {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOnboardingStatusContext debe usarse dentro de OnboardingStatusProvider");
  return ctx;
}
