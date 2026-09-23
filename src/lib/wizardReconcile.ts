// Puerto de wizReconciliarMateriasCreadas()/wizCrearMateriasAprobadas()
// (runtime.js) — las RPCs aplicar_dictados/aplicar_plan escriben
// directo en public.materias del lado del servidor, sin fijar `esc`
// (queda en el default '{}'::jsonb) ni `color_id` (default null). Sin
// este paso, las materias recién creadas por el wizard mostrarían nota
// vacía/sin color en el resto de la app. Se corre después de aplicar_*,
// antes de cerrar el wizard.
import { supabase, usuarioActual } from "@/lib/supabase";
import { materiaColors, type MateriaColorId } from "@/theme/tokens";
import { catEsquema, PERIODO_ACTUAL } from "@/lib/catalog";
import type { Materia } from "@/types/database";

const COLOR_KEYS = (Object.keys(materiaColors) as MateriaColorId[]).filter((k) => k !== "gris");

type Esc = { tipo: "puntos"; total: number; aprob: number; exoneracion: number | null };
type ComponenteFijo = { id: string; titulo: string; puntajeMax: number; valor: null };

async function resolverEsc(materiaCatalogoId: string): Promise<{ esc: Esc; componentesFijos: ComponenteFijo[] } | null> {
  try {
    const filas = await catEsquema(materiaCatalogoId, PERIODO_ACTUAL);
    const f0 = filas[0];
    if (!f0) return null;
    const totalPuntos = filas.filter((f) => f.computa).reduce((sum, f) => sum + (Number(f.puntaje_max) || 0), 0);
    const aprobPct = Number(f0.min_aprobar) || 0;
    const exonPct = f0.min_exonerar != null ? Number(f0.min_exonerar) : null;
    const esc: Esc = {
      tipo: "puntos",
      total: totalPuntos,
      aprob: totalPuntos > 0 ? Math.round((aprobPct / 100) * totalPuntos) : 0,
      exoneracion: exonPct != null && totalPuntos > 0 ? Math.round((exonPct / 100) * totalPuntos) : null,
    };
    const componentesFijos: ComponenteFijo[] = filas
      .filter((f) => f.computa && (!f.fechas || !f.fechas.length))
      .map((f) => ({ id: f.instancia_id, titulo: f.titulo, puntajeMax: Number(f.puntaje_max) || 0, valor: null }));
    return { esc, componentesFijos };
  } catch (e) {
    console.warn("Cursada: no se pudo resolver la escala de aprobación de una materia", e);
    return null;
  }
}

function escIncompleto(esc: unknown): boolean {
  const e = esc as Partial<Esc> | null | undefined;
  return !e || e.tipo == null || e.total == null || e.aprob == null;
}

// Corre después de aplicar_dictados/aplicar_plan: por cada materia recién
// creada en `semestreId` con catalogo_materia_id, resuelve su escala real
// (cat_esquema) y le asigna un color de identidad — antes quedaban con
// esc:{} y color_id:null (defaults de la columna).
export async function reconciliarMateriasCreadas(semestreId: string) {
  const { data: materias, error } = await supabase
    .from("materias")
    .select("id, catalogo_materia_id, esc")
    .eq("semestre_id", semestreId)
    .not("catalogo_materia_id", "is", null);
  if (error) throw error;
  const candidatas = materias ?? [];
  if (!candidatas.length) return;

  const idsAResolver = [...new Set(candidatas.filter((m) => escIncompleto(m.esc)).map((m) => m.catalogo_materia_id as string))];
  const resueltas = new Map<string, { esc: Esc; componentesFijos: ComponenteFijo[] }>();
  await Promise.all(
    idsAResolver.map(async (id) => {
      const r = await resolverEsc(id);
      if (r) resueltas.set(id, r);
    })
  );

  let colorIdx = 0;
  await Promise.all(
    candidatas.map(async (m) => {
      const cambios: Record<string, unknown> = { color_id: COLOR_KEYS[colorIdx % COLOR_KEYS.length] };
      colorIdx++;
      if (escIncompleto(m.esc)) {
        const resuelto = m.catalogo_materia_id ? resueltas.get(m.catalogo_materia_id as string) : null;
        cambios.esc = resuelto ? resuelto.esc : { tipo: "puntos", total: 100, aprob: 70, exoneracion: null };
        cambios.componentes_fijos = resuelto ? resuelto.componentesFijos : [];
      }
      const { error: updErr } = await supabase.from("materias").update(cambios).eq("id", m.id);
      if (updErr) console.warn("Cursada: no se pudo reconciliar una materia creada por el wizard", updErr);
    })
  );
}

export type MateriaAprobadaSel = { materiaId: string; nombre: string; semestreSugerido: number | null };

// Crea, en /onboarding/progreso-anterior (después del wizard/tour), una
// materia "aprobada"/"pendiente"/"recursando" real por cada una tildada ahí
// — nunca las ya cargadas (yaCargadasIds). Cada semestre_sugerido presente
// obtiene su propio semestre histórico (ver obtenerOCrearSemestreHistorico).
// "Recursando" es sólo registro de estado — no se inscribe al semestre
// activo (decisión de producto), mismo criterio de semestre histórico que
// aprobada/pendiente. Devuelve las filas insertadas (con id real) para que
// el paso de notas pueda ofrecer cargar valor en sus componentes_fijos —
// por eso, a diferencia de reconciliarMateriasCreadas, acá SÍ hace falta
// resolver y guardar los componentesFijos (antes se guardaban vacíos, sin
// forma de cargar nota después).
export async function crearMateriasAprobadas(
  aprobadas: MateriaAprobadaSel[],
  pendientes: MateriaAprobadaSel[],
  recursando: MateriaAprobadaSel[],
  yaCargadasIds: Set<string>,
  obtenerSemestreHistorico: (n: number) => Promise<string>
): Promise<Materia[]> {
  const nuevasAprobadas = aprobadas.filter((m) => !yaCargadasIds.has(m.materiaId));
  const nuevasPendientes = pendientes.filter((m) => !yaCargadasIds.has(m.materiaId));
  const nuevasRecursando = recursando.filter((m) => !yaCargadasIds.has(m.materiaId));
  const idsNuevos = [...nuevasAprobadas, ...nuevasPendientes, ...nuevasRecursando];
  if (!idsNuevos.length) return [];

  const user = await usuarioActual();
  const userId = user?.id;
  if (!userId) throw new Error("No hay sesión.");

  const resueltoPorMateria = new Map<string, { esc: Esc; componentesFijos: ComponenteFijo[] }>();
  await Promise.all(
    idsNuevos.map(async (m) => {
      const r = await resolverEsc(m.materiaId);
      if (r) resueltoPorMateria.set(m.materiaId, r);
    })
  );

  const semestresNecesarios = [...new Set(idsNuevos.map((m) => m.semestreSugerido).filter((n): n is number => n != null))];
  const semHistoricoPorNumero = new Map<number, string>();
  for (const n of semestresNecesarios) {
    semHistoricoPorNumero.set(n, await obtenerSemestreHistorico(n));
  }

  const pendientesSet = new Set(nuevasPendientes.map((m) => m.materiaId));
  const recursandoSet = new Set(nuevasRecursando.map((m) => m.materiaId));
  let colorIdx = 0;
  const filas = idsNuevos.map((m) => {
    const resuelto = resueltoPorMateria.get(m.materiaId);
    const esc: Esc = resuelto && resuelto.esc.total > 0 ? resuelto.esc : { tipo: "puntos", total: 100, aprob: 70, exoneracion: null };
    const colorId = COLOR_KEYS[colorIdx % COLOR_KEYS.length];
    colorIdx++;
    const estado = recursandoSet.has(m.materiaId) ? "recursando" : pendientesSet.has(m.materiaId) ? "pendiente" : "aprobada";
    return {
      user_id: userId,
      nombre: m.nombre,
      doc: "",
      color_id: colorId,
      salon: "",
      bloques: [],
      esc,
      estado,
      semestre_id: m.semestreSugerido != null ? (semHistoricoPorNumero.get(m.semestreSugerido) ?? null) : null,
      catalogo_materia_id: m.materiaId,
      catalogo_dictado_id: null,
      componentes_fijos: resuelto?.componentesFijos ?? [],
    };
  });
  const { data, error } = await supabase.from("materias").insert(filas).select();
  if (error) throw error;
  return (data ?? []) as Materia[];
}
