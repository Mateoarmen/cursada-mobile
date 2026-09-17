import type { EventoAgenda, Materia, Personal } from "@/types/database";
import { agendaDeSemestre } from "@/lib/materias";
import { diffDias, MESES_LARGOS, parseISODate, today } from "@/lib/agenda";

// Puerto directo de proximosEnRango()/renderInicio() (runtime.js, ~línea
// 1390): combina evaluaciones/tareas pendientes (agendaDeSemestre + no
// hecho) con eventos personales — los personales NUNCA se acotan por
// semestre, a propósito (ver README de cursada-design-system, sección
// Semestres: "los eventos personales nunca se acotan"), por eso `personalAll`
// entra completo acá y no pasa por agendaDeSemestre.
export type ProximoItem =
  | { tipo: "materia"; fecha: Date; item: EventoAgenda }
  | { tipo: "personal"; fecha: Date; item: Personal };

function proximosEnRango(
  agendaAll: EventoAgenda[],
  materiasAll: Materia[],
  personalAll: Personal[],
  semestreId: string | null,
  t: Date,
  maxDias: number
): ProximoItem[] {
  const out: ProximoItem[] = [];
  agendaDeSemestre(agendaAll, materiasAll, semestreId).forEach((a) => {
    if (a.hecho) return;
    const fecha = parseISODate(a.fecha);
    const diff = diffDias(fecha, t);
    if (diff >= 0 && diff <= maxDias) out.push({ tipo: "materia", fecha, item: a });
  });
  personalAll.forEach((p) => {
    const fecha = parseISODate(p.fecha);
    const diff = diffDias(fecha, t);
    if (diff >= 0 && diff <= maxDias) out.push({ tipo: "personal", fecha, item: p });
  });
  out.sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
  return out;
}

export type ProximosResult = { titulo: string; items: ProximoItem[] };

// Réplica exacta de la cascada de fallback de renderInicio() (runtime.js):
// 1) próximos 7 días: si hay algo, listo ("Próximos 7 días").
// 2) si no hay nada en 7 días: lo que queda del mes en curso ("Este mes").
// 3) si tampoco hay nada este mes: próximo ítem sin límite de fecha,
//    acotado a SU mes (no a todo lo que hay a futuro) — el título pasa a
//    ser el nombre de ese mes.
export function computeProximos(
  agendaAll: EventoAgenda[],
  materiasAll: Materia[],
  personalAll: Personal[],
  semestreId: string | null,
  t: Date = today()
): ProximosResult {
  const diasHastaFinMes = diffDias(new Date(t.getFullYear(), t.getMonth() + 1, 0), t);
  let items = proximosEnRango(agendaAll, materiasAll, personalAll, semestreId, t, 7);
  const usandoMes = !items.length;
  if (usandoMes) items = proximosEnRango(agendaAll, materiasAll, personalAll, semestreId, t, Math.max(7, diasHastaFinMes));
  const usandoOtroMes = usandoMes && !items.length;
  let titulo = "Próximos 7 días";
  if (usandoOtroMes) {
    const siguiente = proximosEnRango(agendaAll, materiasAll, personalAll, semestreId, t, Infinity)[0];
    if (siguiente) {
      const finOtroMes = new Date(siguiente.fecha.getFullYear(), siguiente.fecha.getMonth() + 1, 0);
      items = proximosEnRango(agendaAll, materiasAll, personalAll, semestreId, t, diffDias(finOtroMes, t));
      const nombreMes = MESES_LARGOS[siguiente.fecha.getMonth()]!;
      titulo = nombreMes.charAt(0).toUpperCase() + nombreMes.slice(1);
    }
  } else if (usandoMes) {
    titulo = "Este mes";
  }
  return { titulo, items };
}
