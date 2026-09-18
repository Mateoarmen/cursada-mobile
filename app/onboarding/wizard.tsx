import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";
import { useOnboardingStatusContext } from "@/hooks/OnboardingStatusContext";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, PressableScale, PrimaryButton, Reveal } from "@/components/ui";
import {
  aplicarAgenda,
  aplicarDictados,
  aplicarPlan,
  catCarrerasDe,
  catConflictos,
  catDictados,
  catElectivas,
  catGrupos,
  catMateriasSugeridas,
  DIAS_LARGOS,
  formatHorario,
  horaTexto,
  ORT_UNIVERSITY_ID,
  PERIODO_ACTUAL,
  type Bloque,
  type CatCarrera,
  type CatConflicto,
  type CatDictado,
  type CatElectiva,
  type CatGrupo,
  type CatMateriaSugerida,
} from "@/lib/catalog";
import { obtenerOCrearSemestreHistorico, obtenerOCrearSemestrePeriodo } from "@/lib/semestres";
import { crearMateriasAprobadas, reconciliarMateriasCreadas } from "@/lib/wizardReconcile";

const PASOS = ["carrera", "progreso", "semestre", "oferta", "electivas", "revision"] as const;
type Paso = (typeof PASOS)[number];
const SEMESTRES_RANGE = [1, 2, 3, 4, 5, 6, 7, 8];
const TITULOS: Record<Paso, string> = {
  carrera: "¿Dónde estudiás?",
  progreso: "¿Ya aprobaste materias de esta carrera?",
  semestre: "¿En qué semestre de la carrera estás?",
  oferta: "Elegí tu oferta",
  electivas: "Electivas",
  revision: "Revisá tu semestre",
};

type OfertaSemestre = {
  grupos: CatGrupo[];
  grupoId: string | null;
  grupoMaterias: CatDictado[];
  modo: "grupo" | "manual";
  manualDictados: CatDictado[];
  turnos: string[];
  turno: string | null;
  manualIds: string[];
  sugeridas: CatMateriaSugerida[];
  sinHorarioIds: string[];
};

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

export default function OnboardingWizardScreen() {
  const { colors } = useTheme();
  const { session } = useSession();
  const status = useOnboardingStatusContext();
  const userId = session?.user?.id;

  const [pasoIdx, setPasoIdx] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [carreras, setCarreras] = useState<CatCarrera[] | null>(null);
  const [carreraId, setCarreraId] = useState<string | null>(null);

  const [progresoPorSemestre, setProgresoPorSemestre] = useState<Record<number, CatMateriaSugerida[]>>({});
  const [progresoCargado, setProgresoCargado] = useState(false);
  const [progresoSel, setProgresoSel] = useState<Record<string, "aprobada" | "pendiente">>({});
  const [yaCargadasIds, setYaCargadasIds] = useState<Set<string>>(new Set());

  const [semestresElegidos, setSemestresElegidos] = useState<number[]>([]);
  const [semestreId, setSemestreId] = useState<string | null>(null);

  const [ofertaPorSemestre, setOfertaPorSemestre] = useState<Record<number, OfertaSemestre>>({});
  const [ofertaCargando, setOfertaCargando] = useState(false);

  const [electivaTurno, setElectivaTurno] = useState<"matutino" | "nocturno">("matutino");
  const [electivas, setElectivas] = useState<CatElectiva[]>([]);
  const [electivasCargando, setElectivasCargando] = useState(false);
  const [electivaIds, setElectivaIds] = useState<string[]>([]);

  const [conflictos, setConflictos] = useState<CatConflicto[]>([]);
  const [aceptarSolapamiento, setAceptarSolapamiento] = useState(false);
  const [revisionCargando, setRevisionCargando] = useState(false);

  const paso = PASOS[pasoIdx];

  useEffect(() => {
    catCarrerasDe(ORT_UNIVERSITY_ID)
      .then((c) => {
        if (!c.length) {
          router.replace("/(tabs)/materias");
          return;
        }
        setCarreras(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar el catálogo de carreras."));
  }, []);

  function motivoYaEnProgreso(materiaId: string): string | null {
    if (progresoSel[materiaId] === "aprobada" || yaCargadasIds.has(materiaId)) {
      if (progresoSel[materiaId] === "pendiente") return "Ya la marcaste como pendiente de examen.";
      return "Ya la marcaste como aprobada.";
    }
    if (progresoSel[materiaId] === "pendiente") return "Ya la marcaste como pendiente de examen.";
    return null;
  }

  async function cargarProgreso() {
    if (!carreraId) return;
    setProgresoCargado(false);
    try {
      const resultados = await Promise.all(SEMESTRES_RANGE.map((s) => catMateriasSugeridas(carreraId, s, PERIODO_ACTUAL)));
      const porSem: Record<number, CatMateriaSugerida[]> = {};
      SEMESTRES_RANGE.forEach((s, i) => {
        porSem[s] = resultados[i];
      });
      setProgresoPorSemestre(porSem);

      const { data: materias } = await supabase.from("materias").select("catalogo_materia_id, estado").not("catalogo_materia_id", "is", null);
      const cargadas = new Set<string>();
      const preSel: Record<string, "aprobada" | "pendiente"> = {};
      (materias ?? []).forEach((m) => {
        if (!m.catalogo_materia_id) return;
        if (m.estado === "aprobada" || m.estado === "pendiente") {
          cargadas.add(m.catalogo_materia_id);
          preSel[m.catalogo_materia_id] = m.estado;
        }
      });
      setYaCargadasIds(cargadas);
      setProgresoSel(preSel);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el plan de tu carrera.");
    } finally {
      setProgresoCargado(true);
    }
  }

  async function cargarOferta() {
    if (!carreraId) return;
    setOfertaCargando(true);
    try {
      const entries = await Promise.all(
        semestresElegidos.map(async (s): Promise<[number, OfertaSemestre]> => {
          const [grupos, dictados] = await Promise.all([catGrupos(carreraId, PERIODO_ACTUAL, s), catDictados(carreraId, PERIODO_ACTUAL, [s])]);
          const turnos = [...new Set(dictados.map((d) => d.turno).filter((t): t is string => !!t))];
          let turnoDefault: string | null = null;
          if (turnos.length) {
            const conteo: Record<string, number> = {};
            dictados.forEach((d) => {
              if (d.turno) conteo[d.turno] = (conteo[d.turno] || 0) + 1;
            });
            turnoDefault = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0][0];
          }
          const sugeridas = dictados.length ? [] : await catMateriasSugeridas(carreraId, s, PERIODO_ACTUAL);
          return [
            s,
            { grupos, grupoId: null, grupoMaterias: [], modo: grupos.length ? "grupo" : "manual", manualDictados: dictados, turnos, turno: turnoDefault, manualIds: [], sugeridas, sinHorarioIds: [] },
          ];
        })
      );
      setOfertaPorSemestre(Object.fromEntries(entries));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la oferta de materias.");
    } finally {
      setOfertaCargando(false);
    }
  }

  async function seleccionarGrupo(s: number, grupo: CatGrupo | null) {
    setOfertaPorSemestre((prev) => ({ ...prev, [s]: { ...prev[s], grupoId: grupo?.id ?? null, grupoMaterias: [] } }));
    if (!grupo || !carreraId) return;
    try {
      const dictados = await catDictados(carreraId, PERIODO_ACTUAL, [s], grupo.turno ?? null);
      const propios = dictados.filter((d) => d.grupo === grupo.codigo);
      setOfertaPorSemestre((prev) => ({ ...prev, [s]: { ...prev[s], grupoMaterias: propios } }));
    } catch (e) {
      console.warn("Cursada: no se pudo resolver el detalle de horario del grupo", e);
    }
  }

  function inferirTurnoElectivas(): "matutino" | "nocturno" {
    const conteo: Record<string, number> = {};
    Object.values(ofertaPorSemestre).forEach((o) => {
      if (o.modo === "grupo") {
        const g = o.grupos.find((x) => x.id === o.grupoId);
        if (g?.turno) conteo[g.turno] = (conteo[g.turno] || 0) + 1;
      } else if (o.turno) {
        conteo[o.turno] = (conteo[o.turno] || 0) + 1;
      }
    });
    const mejor = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]?.[0];
    return mejor === "nocturno" ? "nocturno" : "matutino";
  }

  async function cargarElectivas(turno: "matutino" | "nocturno") {
    setElectivasCargando(true);
    try {
      const rows = await catElectivas(ORT_UNIVERSITY_ID, PERIODO_ACTUAL, turno);
      setElectivas(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar las electivas.");
    } finally {
      setElectivasCargando(false);
    }
  }

  function dictadoIdsElegidosTotal(): string[] {
    const ids: string[] = [];
    Object.values(ofertaPorSemestre).forEach((o) => {
      if (o.modo === "grupo") ids.push(...o.grupoMaterias.map((m) => m.dictado_id));
      else ids.push(...o.manualIds);
    });
    ids.push(...electivaIds);
    return [...new Set(ids)];
  }

  function materiaIdsSinHorarioTotal(): string[] {
    return Object.values(ofertaPorSemestre).flatMap((o) => o.sinHorarioIds);
  }

  async function cargarRevision() {
    setRevisionCargando(true);
    setAceptarSolapamiento(false);
    try {
      const ids = dictadoIdsElegidosTotal();
      const conf = ids.length ? await catConflictos(ids) : [];
      setConflictos(conf);
    } catch (e) {
      console.warn("Cursada: no se pudo chequear conflictos de horario", e);
      setConflictos([]);
    } finally {
      setRevisionCargando(false);
    }
  }

  function buscarEnProgreso(materiaId: string): CatMateriaSugerida | undefined {
    for (const arr of Object.values(progresoPorSemestre)) {
      const found = arr.find((m) => m.materia_id === materiaId);
      if (found) return found;
    }
    return undefined;
  }

  async function confirmar() {
    if (conflictos.length && !aceptarSolapamiento) {
      setError("Tildá que confirmás igual, o volvé atrás y sacá alguna materia en conflicto.");
      return;
    }
    if (!semestreId) {
      setError("Falta preparar el semestre — volvé al paso anterior.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const dictadoIds = dictadoIdsElegidosTotal();
      if (dictadoIds.length) await aplicarDictados(semestreId, dictadoIds);
      const materiaIds = materiaIdsSinHorarioTotal();
      if (materiaIds.length) await aplicarPlan(semestreId, materiaIds, PERIODO_ACTUAL);
      await aplicarAgenda(semestreId);
      await reconciliarMateriasCreadas(semestreId);

      const aprobadas = Object.entries(progresoSel)
        .filter(([, v]) => v === "aprobada")
        .map(([materiaId]) => {
          const f = buscarEnProgreso(materiaId);
          return { materiaId, nombre: f?.nombre ?? "", semestreSugerido: f?.semestre_sugerido ?? null };
        });
      const pendientes = Object.entries(progresoSel)
        .filter(([, v]) => v === "pendiente")
        .map(([materiaId]) => {
          const f = buscarEnProgreso(materiaId);
          return { materiaId, nombre: f?.nombre ?? "", semestreSugerido: f?.semestre_sugerido ?? null };
        });
      await crearMateriasAprobadas(aprobadas, pendientes, yaCargadasIds, obtenerOCrearSemestreHistorico);

      await status.refresh();
      router.replace("/(tabs)");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aplicar la selección — intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const handleContinuar = async () => {
    setError(null);
    if (paso === "carrera") {
      if (!carreraId) {
        setError("Elegí tu carrera para continuar.");
        return;
      }
      setBusy(true);
      try {
        if (!userId) throw new Error("No hay sesión.");
        const { error: upErr } = await supabase.from("profiles").upsert({ id: userId, carrera_id: carreraId });
        if (upErr) throw upErr;
      } catch (e) {
        setBusy(false);
        setError(e instanceof Error ? e.message : "No se pudo guardar tu carrera — revisá tu conexión e intentá de nuevo.");
        return;
      }
      setBusy(false);
      setPasoIdx(1);
      await cargarProgreso();
    } else if (paso === "progreso") {
      setPasoIdx(2);
    } else if (paso === "semestre") {
      if (!semestresElegidos.length) {
        setError("Elegí al menos un semestre.");
        return;
      }
      setBusy(true);
      try {
        const id = await obtenerOCrearSemestrePeriodo(PERIODO_ACTUAL);
        setSemestreId(id);
      } catch (e) {
        setBusy(false);
        setError(e instanceof Error ? e.message : "No se pudo preparar el semestre.");
        return;
      }
      setBusy(false);
      setPasoIdx(3);
      await cargarOferta();
    } else if (paso === "oferta") {
      const turnoDefault = inferirTurnoElectivas();
      setElectivaTurno(turnoDefault);
      setPasoIdx(4);
      await cargarElectivas(turnoDefault);
    } else if (paso === "electivas") {
      setPasoIdx(5);
      await cargarRevision();
    } else if (paso === "revision") {
      await confirmar();
    }
  };

  const handleAtras = () => {
    setError(null);
    if (pasoIdx > 0) setPasoIdx(pasoIdx - 1);
  };

  const salirAManual = () => {
    router.replace("/(tabs)/materias");
  };

  const items = useMemo(() => {
    const out: { id: string; nombre: string; salon: string | null; bloques: Bloque[] }[] = [];
    Object.values(ofertaPorSemestre).forEach((o) => {
      if (o.modo === "grupo") o.grupoMaterias.forEach((m) => out.push({ id: m.dictado_id, nombre: m.nombre, salon: m.salon, bloques: m.bloques }));
      else o.manualDictados.filter((d) => o.manualIds.includes(d.dictado_id)).forEach((d) => out.push({ id: d.dictado_id, nombre: d.nombre, salon: d.salon, bloques: d.bloques }));
    });
    electivas.filter((e) => electivaIds.includes(e.dictado_id)).forEach((e) => out.push({ id: e.dictado_id, nombre: e.nombre, salon: null, bloques: e.bloques }));
    return out;
  }, [ofertaPorSemestre, electivas, electivaIds]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View
        style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.sm, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        accessible
        accessibilityLabel={`Paso ${pasoIdx + 1} de ${PASOS.length}: ${TITULOS[paso]}`}
      >
        <View style={{ flexDirection: "row", gap: 4 }}>
          {PASOS.map((p, i) => (
            <View key={p} style={{ width: 22, height: 4, borderRadius: 2, backgroundColor: i <= pasoIdx ? colors.accent : colors.surfaceSoft }} />
          ))}
        </View>
        <PressableScale scaleTo={0.98} onPress={salirAManual}>
          <AppText weight="500" style={{ fontSize: 12, color: colors.textTertiary }}>
            Prefiero cargarlo a mano
          </AppText>
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, paddingBottom: 140 }}>
        {/* key={paso} — mismo criterio que app/materia/nueva.tsx: un
            momento autoral por transición de paso, no una entrada por
            campo. Sin Spotlight acá: a diferencia de las pantallas de
            "mirar" (Inicio/Agenda/Horario), este es un flujo de carga de
            datos denso en chips de selección — el wash compite con el
            contraste que esos chips ya necesitan. */}
        <Reveal key={paso} style={{ gap: spacing.lg }}>
        <AppText weight="700" style={{ fontSize: 22, letterSpacing: -0.3 }}>
          {TITULOS[paso]}
        </AppText>

        {paso === "carrera" ? (
          <View style={{ gap: spacing.sm }}>
            {!carreras ? (
              <AppText style={{ fontSize: 14, color: colors.textTertiary }}>Cargando carreras…</AppText>
            ) : (
              carreras.map((c) => (
                <PressableScale
                  key={c.id}
                  scaleTo={0.98}
                  onPress={() => setCarreraId(c.id)}
                  style={{
                    padding: spacing.lg,
                    borderRadius: radii.md,
                    backgroundColor: carreraId === c.id ? colors.accentSoft : colors.surface,
                    borderWidth: carreraId === c.id ? 1.5 : 0,
                    borderColor: colors.accent,
                    gap: 4,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <AppText weight="600" style={{ fontSize: 15, flex: 1 }}>
                      {c.nombre}
                    </AppText>
                    {c.plan_version ? (
                      <AppText mono style={{ fontSize: 11, color: colors.textFaint }}>
                        {c.plan_version}
                      </AppText>
                    ) : null}
                  </View>
                  {c.facultad ? (
                    <AppText style={{ fontSize: 12, color: colors.textTertiary }}>{c.facultad}</AppText>
                  ) : null}
                </PressableScale>
              ))
            )}
          </View>
        ) : null}

        {paso === "progreso" ? (
          <View style={{ gap: spacing.lg }}>
            <AppText style={{ fontSize: 13, color: colors.textTertiary }}>
              Opcional — tildá las que ya diste, así tu progreso hacia el título arranca correcto.
            </AppText>
            {!progresoCargado ? (
              <AppText style={{ fontSize: 14, color: colors.textTertiary }}>Cargando el plan de tu carrera…</AppText>
            ) : (
              SEMESTRES_RANGE.map((s) => {
                const materias = progresoPorSemestre[s] ?? [];
                if (!materias.length) return null;
                return (
                  <View key={s} style={{ gap: spacing.sm }}>
                    <AppText weight="700" style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: colors.textFaint }}>
                      Semestre {s}
                    </AppText>
                    {materias.map((m) => {
                      const yaCargada = yaCargadasIds.has(m.materia_id);
                      const sel = progresoSel[m.materia_id];
                      return (
                        <View key={m.materia_id} style={{ backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm }}>
                          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                            <AppText weight="500" style={{ fontSize: 14, flex: 1 }} numberOfLines={1}>
                              {m.nombre}
                            </AppText>
                            {yaCargada ? (
                              <AppText mono style={{ fontSize: 11, color: colors.textFaint }}>
                                Ya cargada
                              </AppText>
                            ) : null}
                          </View>
                          {!yaCargada ? (
                            <View style={{ flexDirection: "row", gap: spacing.sm }}>
                              <PressableScale
                                scaleTo={0.97}
                                onPress={() =>
                                  setProgresoSel((prev) => {
                                    const next = { ...prev };
                                    if (next[m.materia_id] === "aprobada") delete next[m.materia_id];
                                    else next[m.materia_id] = "aprobada";
                                    return next;
                                  })
                                }
                                style={{
                                  flex: 1,
                                  height: 34,
                                  borderRadius: radii.sm,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: sel === "aprobada" ? colors.successSoft : colors.surfaceSoft,
                                }}
                              >
                                <AppText weight="600" style={{ fontSize: 12, color: sel === "aprobada" ? colors.successText : colors.textSecondary }}>
                                  Aprobada
                                </AppText>
                              </PressableScale>
                              <PressableScale
                                scaleTo={0.97}
                                onPress={() =>
                                  setProgresoSel((prev) => {
                                    const next = { ...prev };
                                    if (next[m.materia_id] === "pendiente") delete next[m.materia_id];
                                    else next[m.materia_id] = "pendiente";
                                    return next;
                                  })
                                }
                                style={{
                                  flex: 1,
                                  height: 34,
                                  borderRadius: radii.sm,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: sel === "pendiente" ? colors.warningSoft : colors.surfaceSoft,
                                }}
                              >
                                <AppText weight="600" style={{ fontSize: 12, color: sel === "pendiente" ? colors.warningText : colors.textSecondary }}>
                                  Debo rendir examen
                                </AppText>
                              </PressableScale>
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                );
              })
            )}
          </View>
        ) : null}

        {paso === "semestre" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {SEMESTRES_RANGE.map((n) => {
              const on = semestresElegidos.includes(n);
              return (
                <PressableScale
                  key={n}
                  scaleTo={0.94}
                  onPress={() => setSemestresElegidos((prev) => toggle(prev, n))}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: on ? colors.accent : colors.surface,
                  }}
                >
                  <AppText weight="700" style={{ fontSize: 17, color: on ? colors.white : colors.text }}>
                    {n}
                  </AppText>
                </PressableScale>
              );
            })}
          </View>
        ) : null}

        {paso === "oferta" ? (
          <View style={{ gap: spacing.xl }}>
            {ofertaCargando ? (
              <AppText style={{ fontSize: 14, color: colors.textTertiary }}>Buscando tu oferta…</AppText>
            ) : (
              semestresElegidos
                .slice()
                .sort((a, b) => a - b)
                .map((s) => {
                  const o = ofertaPorSemestre[s];
                  if (!o) return null;
                  return (
                    <View key={s} style={{ gap: spacing.sm }}>
                      {semestresElegidos.length > 1 ? (
                        <AppText weight="700" style={{ fontSize: 11, letterSpacing: 0.6, textTransform: "uppercase", color: colors.textFaint }}>
                          Semestre {s}
                        </AppText>
                      ) : null}

                      {o.modo === "grupo" ? (
                        <>
                          {o.grupos.map((g) => (
                            <PressableScale
                              key={g.id}
                              scaleTo={0.98}
                              onPress={() => seleccionarGrupo(s, o.grupoId === g.id ? null : g)}
                              style={{
                                padding: spacing.md,
                                borderRadius: radii.md,
                                backgroundColor: o.grupoId === g.id ? colors.accentSoft : colors.surface,
                                borderWidth: o.grupoId === g.id ? 1.5 : 0,
                                borderColor: colors.accent,
                              }}
                            >
                              <AppText weight="600" style={{ fontSize: 14 }}>
                                {g.codigo}
                              </AppText>
                              <AppText style={{ fontSize: 12, color: colors.textTertiary }}>
                                {[g.turno, g.edificio, `${g.materias} ${g.materias === 1 ? "materia" : "materias"}`].filter(Boolean).join(" · ")}
                              </AppText>
                            </PressableScale>
                          ))}
                          {o.grupoMaterias.length ? (
                            <View style={{ gap: 6, paddingLeft: spacing.md, borderLeftWidth: 2, borderLeftColor: colors.borderFaint }}>
                              {o.grupoMaterias.map((m) => (
                                <View key={m.dictado_id} style={{ gap: 1 }}>
                                  <AppText weight="500" style={{ fontSize: 13 }}>
                                    {m.nombre}
                                  </AppText>
                                  <AppText style={{ fontSize: 11, color: colors.textFaint }}>{[m.salon, formatHorario(m.bloques)].filter(Boolean).join(" · ")}</AppText>
                                </View>
                              ))}
                            </View>
                          ) : null}
                          <PressableScale
                            scaleTo={0.98}
                            onPress={() => setOfertaPorSemestre((prev) => ({ ...prev, [s]: { ...prev[s], modo: "manual" } }))}
                          >
                            <AppText weight="500" style={{ fontSize: 12, color: colors.accentText }}>
                              Prefiero elegir materias sueltas para este semestre
                            </AppText>
                          </PressableScale>
                        </>
                      ) : (
                        <>
                          {o.turnos.length > 1 ? (
                            <View style={{ flexDirection: "row", gap: 6 }}>
                              {o.turnos.map((t) => (
                                <PressableScale
                                  key={t}
                                  scaleTo={0.96}
                                  onPress={() => setOfertaPorSemestre((prev) => ({ ...prev, [s]: { ...prev[s], turno: t } }))}
                                  style={{
                                    height: 30,
                                    paddingHorizontal: spacing.md,
                                    borderRadius: radii.round,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    backgroundColor: o.turno === t ? colors.text : colors.surfaceSoft,
                                  }}
                                >
                                  <AppText weight="600" style={{ fontSize: 12, color: o.turno === t ? colors.bg : colors.textSecondary }}>
                                    {t.charAt(0).toUpperCase() + t.slice(1)}
                                  </AppText>
                                </PressableScale>
                              ))}
                            </View>
                          ) : null}
                          {o.manualDictados.length ? (
                            o.manualDictados
                              .filter((d) => !o.turno || !d.turno || d.turno === o.turno)
                              .map((d) => {
                                const motivo = motivoYaEnProgreso(d.materia_id);
                                const on = o.manualIds.includes(d.dictado_id);
                                return (
                                  <PressableScale
                                    key={d.dictado_id}
                                    scaleTo={0.98}
                                    disabled={!!motivo}
                                    onPress={() => setOfertaPorSemestre((prev) => ({ ...prev, [s]: { ...prev[s], manualIds: toggle(prev[s].manualIds, d.dictado_id) } }))}
                                    style={{
                                      padding: spacing.md,
                                      borderRadius: radii.md,
                                      backgroundColor: on ? colors.accentSoft : colors.surface,
                                      borderWidth: on ? 1.5 : 0,
                                      borderColor: colors.accent,
                                      opacity: motivo ? 0.5 : 1,
                                      gap: 2,
                                    }}
                                  >
                                    <AppText weight="600" style={{ fontSize: 13 }}>
                                      {d.nombre}
                                    </AppText>
                                    <AppText style={{ fontSize: 11, color: colors.textFaint }}>
                                      {[d.grupo, d.turno, d.salon, formatHorario(d.bloques)].filter(Boolean).join(" · ")}
                                    </AppText>
                                    {motivo ? (
                                      <AppText style={{ fontSize: 11, color: colors.warningText }}>{motivo}</AppText>
                                    ) : null}
                                  </PressableScale>
                                );
                              })
                          ) : (
                            <>
                              <AppText style={{ fontSize: 12, color: colors.textFaint, fontStyle: "italic" }}>
                                Sin horario cargado en el catálogo todavía — elegí las materias y completá el horario vos después.
                              </AppText>
                              {o.sugeridas.map((m) => {
                                const motivo = motivoYaEnProgreso(m.materia_id);
                                const on = o.sinHorarioIds.includes(m.materia_id);
                                return (
                                  <PressableScale
                                    key={m.materia_id}
                                    scaleTo={0.98}
                                    disabled={!!motivo}
                                    onPress={() =>
                                      setOfertaPorSemestre((prev) => ({ ...prev, [s]: { ...prev[s], sinHorarioIds: toggle(prev[s].sinHorarioIds, m.materia_id) } }))
                                    }
                                    style={{
                                      padding: spacing.md,
                                      borderRadius: radii.md,
                                      backgroundColor: on ? colors.accentSoft : colors.surface,
                                      borderWidth: on ? 1.5 : 0,
                                      borderColor: colors.accent,
                                      opacity: motivo ? 0.5 : 1,
                                      gap: 2,
                                    }}
                                  >
                                    <AppText weight="600" style={{ fontSize: 13 }}>
                                      {m.nombre}
                                    </AppText>
                                    <AppText style={{ fontSize: 11, color: colors.textFaint }}>
                                      {(m.creditos ? `${m.creditos} créditos` : "") + (m.obligatoria === false ? " · electiva de plan" : "")}
                                    </AppText>
                                    {motivo ? <AppText style={{ fontSize: 11, color: colors.warningText }}>{motivo}</AppText> : null}
                                  </PressableScale>
                                );
                              })}
                            </>
                          )}
                          {o.grupos.length ? (
                            <PressableScale scaleTo={0.98} onPress={() => setOfertaPorSemestre((prev) => ({ ...prev, [s]: { ...prev[s], modo: "grupo" } }))}>
                              <AppText weight="500" style={{ fontSize: 12, color: colors.accentText }}>
                                Ver los grupos armados para este semestre
                              </AppText>
                            </PressableScale>
                          ) : null}
                        </>
                      )}
                    </View>
                  );
                })
            )}
          </View>
        ) : null}

        {paso === "electivas" ? (
          <View style={{ gap: spacing.md }}>
            <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Opcional — elegí las que estés cursando este semestre.</AppText>
            <View style={{ flexDirection: "row", gap: 6 }}>
              {(["matutino", "nocturno"] as const).map((t) => (
                <PressableScale
                  key={t}
                  scaleTo={0.96}
                  onPress={() => {
                    setElectivaTurno(t);
                    cargarElectivas(t);
                  }}
                  style={{
                    height: 32,
                    paddingHorizontal: spacing.md,
                    borderRadius: radii.round,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: electivaTurno === t ? colors.text : colors.surfaceSoft,
                  }}
                >
                  <AppText weight="600" style={{ fontSize: 13, color: electivaTurno === t ? colors.bg : colors.textSecondary }}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </AppText>
                </PressableScale>
              ))}
            </View>
            {electivasCargando ? (
              <AppText style={{ fontSize: 14, color: colors.textTertiary }}>Cargando electivas…</AppText>
            ) : !electivas.length ? (
              <AppText style={{ fontSize: 13, color: colors.textTertiary }}>No hay electivas para este turno todavía — podés continuar sin elegir ninguna.</AppText>
            ) : (
              electivas.map((e) => {
                const motivo = e.estado === "sin_minimo" ? "No se abrió por falta de inscriptos." : motivoYaEnProgreso(e.materia_id);
                const on = electivaIds.includes(e.dictado_id);
                const repetida = electivas.filter((x) => x.materia_id === e.materia_id).length > 1;
                return (
                  <PressableScale
                    key={e.dictado_id}
                    scaleTo={0.98}
                    disabled={!!motivo}
                    onPress={() => setElectivaIds((prev) => toggle(prev, e.dictado_id))}
                    style={{
                      padding: spacing.md,
                      borderRadius: radii.md,
                      backgroundColor: on ? colors.accentSoft : colors.surface,
                      borderWidth: on ? 1.5 : 0,
                      borderColor: colors.accent,
                      opacity: motivo ? 0.5 : 1,
                      gap: 2,
                    }}
                  >
                    <AppText weight="600" style={{ fontSize: 13 }}>
                      {e.nombre}
                      {repetida ? ` — Sección ${e.seccion}` : ""}
                    </AppText>
                    <AppText style={{ fontSize: 11, color: colors.textFaint }}>{[e.turno, formatHorario(e.bloques)].filter(Boolean).join(" · ")}</AppText>
                    {motivo ? <AppText style={{ fontSize: 11, color: colors.warningText }}>{motivo}</AppText> : null}
                  </PressableScale>
                );
              })
            )}
          </View>
        ) : null}

        {paso === "revision" ? (
          <View style={{ gap: spacing.lg }}>
            {revisionCargando ? (
              <AppText style={{ fontSize: 14, color: colors.textTertiary }}>Revisando conflictos de horario…</AppText>
            ) : (
              <>
                {conflictos.length ? (
                  <View style={{ backgroundColor: colors.dangerSofter, borderRadius: radii.md, padding: spacing.md, gap: spacing.sm }}>
                    <AppText weight="700" style={{ fontSize: 13, color: colors.dangerText }}>
                      Hay materias que se pisan:
                    </AppText>
                    {conflictos.map((c, i) => (
                      <AppText key={i} style={{ fontSize: 12, color: colors.textSecondary }}>
                        {c.materia_a} ⚡ {c.materia_b} — {DIAS_LARGOS[c.dia]} {horaTexto(c.desde)}–{horaTexto(c.hasta)}
                      </AppText>
                    ))}
                    <PressableScale scaleTo={0.98} onPress={() => setAceptarSolapamiento((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingTop: 4 }}>
                      <AppIcon name={aceptarSolapamiento ? "checkbox" : "square-outline"} size={18} color={colors.text} />
                      <AppText style={{ fontSize: 12, color: colors.textSecondary }}>Confirmar igual, ya sé que se pisan.</AppText>
                    </PressableScale>
                  </View>
                ) : null}

                <View style={{ gap: spacing.sm }}>
                  {items.map((it) => (
                    <View key={it.id} style={{ backgroundColor: colors.surface, borderRadius: radii.md, padding: spacing.md, gap: 2 }}>
                      <AppText weight="600" style={{ fontSize: 14 }}>
                        {it.nombre}
                      </AppText>
                      <AppText style={{ fontSize: 12, color: colors.textTertiary }}>{[it.salon, formatHorario(it.bloques)].filter(Boolean).join(" · ")}</AppText>
                    </View>
                  ))}
                </View>

                <AppText style={{ fontSize: 13, color: colors.textTertiary }}>
                  {items.length} {items.length === 1 ? "materia con horario" : "materias con horario"}
                  {materiaIdsSinHorarioTotal().length
                    ? `, ${materiaIdsSinHorarioTotal().length} ${materiaIdsSinHorarioTotal().length === 1 ? "materia sin horario (la completás vos después)" : "materias sin horario (las completás vos después)"}`
                    : ""}
                  .
                </AppText>
              </>
            )}
          </View>
        ) : null}

        </Reveal>

        {error ? (
          <View
            accessible
            accessibilityLabel={error}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.md,
              backgroundColor: colors.dangerSofter,
              borderRadius: radii.md,
              padding: spacing.lg,
            }}
          >
            <AppIcon name="alert-circle-outline" size={18} color={colors.dangerText} />
            <AppText style={{ flex: 1, fontSize: 13, color: colors.dangerText }}>{error}</AppText>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md,
          paddingBottom: spacing.xxl,
          backgroundColor: colors.bg,
          borderTopWidth: 1,
          borderTopColor: colors.borderFaint,
          flexDirection: "row",
          gap: spacing.sm,
        }}
      >
        {pasoIdx > 0 ? <PrimaryButton label="Atrás" variant="ghost" onPress={handleAtras} /> : null}
        <PrimaryButton label={paso === "revision" ? "Confirmar" : "Continuar"} flex onPress={handleContinuar} disabled={busy} />
      </View>
    </SafeAreaView>
  );
}
