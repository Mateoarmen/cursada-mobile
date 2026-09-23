import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";
import { useOnboardingStatusContext } from "@/hooks/OnboardingStatusContext";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, LoadingScreen, PressableScale, PrimaryButton, Reveal } from "@/components/ui";
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
  PERIODO_ACTUAL,
  type Bloque,
  type CatCarrera,
  type CatConflicto,
  type CatDictado,
  type CatElectiva,
  type CatGrupo,
  type CatMateriaSugerida,
} from "@/lib/catalog";
import { obtenerOCrearSemestrePeriodo } from "@/lib/semestres";
import { reconciliarMateriasCreadas } from "@/lib/wizardReconcile";
import { PASOS_TOUR, useTourContext } from "@/hooks/TourContext";
import type { University } from "@/types/database";

// El flujo completo (con electivas con horario) es para universidades cuyo
// catálogo trae dictados/horarios, como ORT. Una universidad que sólo
// cargó plan de estudios (carrera → materias por semestre, sin dictados)
// — como FCEA/UdelaR — usa el flujo simple: carrera, semestre, materias
// del semestre, confirmar. El progreso de materias ya aprobadas (y sus
// notas) se pregunta después, en /onboarding/progreso-anterior — no puede
// vivir acá porque depende de materias que sólo existen después de
// confirmar() (y para ORT va después del tour, fuera de este stack).
const PASOS_COMPLETO = ["universidad", "carrera", "semestre", "oferta", "electivas", "revision"] as const;
const PASOS_SIMPLE = ["universidad", "carrera", "semestre", "oferta", "revision"] as const;
type Paso = (typeof PASOS_COMPLETO)[number];
const SEMESTRES_RANGE = [1, 2, 3, 4, 5, 6, 7, 8];
const TITULOS: Record<Paso, string> = {
  universidad: "¿Dónde estudiás?",
  carrera: "¿Qué carrera cursás?",
  semestre: "¿En qué semestre de la carrera estás?",
  oferta: "Elegí tu oferta",
  electivas: "Electivas",
  revision: "Revisá tu semestre",
};

type OfertaSemestre = {
  grupos: CatGrupo[];
  // Se pueden elegir varios grupos del mismo semestre (ej. un grupo de la
  // mañana y otro de la noche). Las materias de cada uno se cargan al
  // abrirlo y quedan cacheadas por id — la ausencia de la clave significa
  // "todavía cargando".
  grupoIds: string[];
  materiasPorGrupo: Record<string, CatDictado[]>;
  // dictado_ids de los grupos elegidos que el usuario destildó (no las
  // cursa) — por defecto cada grupo entra completo, y de acá se sacan las que no.
  grupoExcluidos: string[];
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

function grupoElegidas(o: OfertaSemestre): CatDictado[] {
  const vistos = new Set<string>();
  return o.grupoIds
    .flatMap((id) => o.materiasPorGrupo[id] ?? [])
    .filter((m) => {
      if (o.grupoExcluidos.includes(m.dictado_id) || vistos.has(m.dictado_id)) return false;
      vistos.add(m.dictado_id);
      return true;
    });
}

export default function OnboardingWizardScreen() {
  const { colors } = useTheme();
  const { session } = useSession();
  const status = useOnboardingStatusContext();
  const tour = useTourContext();
  const userId = session?.user?.id;

  // Retoma donde se cortó: universidad y carrera se guardan en el perfil al
  // confirmar cada paso, así que si ya están, se precargan y se arranca en
  // el primero que falta en vez de volver a preguntarlos.
  const perfilInicial = status.profile;
  const [pasoIdx, setPasoIdx] = useState(() => (perfilInicial?.university_id ? (perfilInicial.carrera_id ? 2 : 1) : 0));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // null mientras no se sabe todavía (antes de elegir carrera) — se decide
  // apenas se confirma la carrera, sondeando si tiene dictados cargados.
  const [catalogoConHorario, setCatalogoConHorario] = useState<boolean | null>(null);
  const PASOS: readonly Paso[] = catalogoConHorario === false ? PASOS_SIMPLE : PASOS_COMPLETO;

  const [universidades, setUniversidades] = useState<University[] | null>(null);
  // Estado local, no leído de status.profile: el perfil recién se actualiza
  // cuando se confirma este paso (mismo criterio que carreraId más abajo),
  // así el efecto que carga carreras (más abajo, keyed en universidadId) no
  // depende de refrescar el contexto a mitad de wizard.
  const [universidadId, setUniversidadId] = useState<string | null>(perfilInicial?.university_id ?? null);
  const [universidadOtra, setUniversidadOtra] = useState("");

  const [carreras, setCarreras] = useState<CatCarrera[] | null>(null);
  const [carreraId, setCarreraId] = useState<string | null>(perfilInicial?.carrera_id ?? null);

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
    supabase
      .from("universities")
      .select("*")
      .order("nombre")
      .then(({ data }) => setUniversidades((data as University[]) ?? []));
  }, []);

  useEffect(() => {
    if (!universidadId || universidadId === "otra") return;
    catCarrerasDe(universidadId)
      .then(async (c) => {
        if (!c.length) {
          // Universidad sin ningún catálogo cargado — antes esta rama era
          // inalcanzable (sólo se entraba al wizard con catálogo ya
          // confirmado); ahora que "universidad" es el primer paso del
          // wizard, puede pasar de verdad. Refrescar acá (recién ahora se
          // sabe que hace falta) y volver al gate externo: con university_id
          // ya guardado y el contexto al día, eligibleForWizard da false
          // solo y cae al onboarding genérico (app/onboarding/index.tsx).
          await status.refresh();
          router.replace("/onboarding");
          return;
        }
        setCarreras(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar el catálogo de carreras."));
  }, [universidadId]);

  // Al retomar con la carrera ya elegida no se pasa por el "Continuar" de
  // carrera, que es quien decide flujo completo vs. simple — se sondea acá.
  useEffect(() => {
    if (!perfilInicial?.carrera_id) return;
    catDictados(perfilInicial.carrera_id, PERIODO_ACTUAL)
      .catch(() => [])
      .then((d) => setCatalogoConHorario(d.length > 0));
  }, []);

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
            { grupos, grupoIds: [], materiasPorGrupo: {}, grupoExcluidos: [], modo: grupos.length ? "grupo" : "manual", manualDictados: dictados, turnos, turno: turnoDefault, manualIds: [], sugeridas, sinHorarioIds: [] },
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

  async function alternarGrupo(s: number, grupo: CatGrupo) {
    const yaElegido = ofertaPorSemestre[s]?.grupoIds.includes(grupo.id);
    setOfertaPorSemestre((prev) => {
      const o = prev[s];
      return { ...prev, [s]: { ...o, grupoIds: yaElegido ? o.grupoIds.filter((id) => id !== grupo.id) : [...o.grupoIds, grupo.id] } };
    });
    if (yaElegido || !carreraId || ofertaPorSemestre[s]?.materiasPorGrupo[grupo.id]) return;
    let propios: CatDictado[] = [];
    try {
      const dictados = await catDictados(carreraId, PERIODO_ACTUAL, [s], grupo.turno ?? null);
      propios = dictados.filter((d) => d.grupo === grupo.codigo);
    } catch (e) {
      console.warn("Cursada: no se pudo resolver el detalle de horario del grupo", e);
    }
    setOfertaPorSemestre((prev) => ({ ...prev, [s]: { ...prev[s], materiasPorGrupo: { ...prev[s].materiasPorGrupo, [grupo.id]: propios } } }));
  }

  function inferirTurnoElectivas(): "matutino" | "nocturno" {
    const conteo: Record<string, number> = {};
    Object.values(ofertaPorSemestre).forEach((o) => {
      if (o.modo === "grupo") {
        o.grupos
          .filter((x) => o.grupoIds.includes(x.id))
          .forEach((g) => {
            if (g.turno) conteo[g.turno] = (conteo[g.turno] || 0) + 1;
          });
      } else if (o.turno) {
        conteo[o.turno] = (conteo[o.turno] || 0) + 1;
      }
    });
    const mejor = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0]?.[0];
    return mejor === "nocturno" ? "nocturno" : "matutino";
  }

  async function cargarElectivas(turno: "matutino" | "nocturno") {
    if (!universidadId || universidadId === "otra") return;
    setElectivasCargando(true);
    try {
      const rows = await catElectivas(universidadId, PERIODO_ACTUAL, turno);
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
      if (o.modo === "grupo") ids.push(...grupoElegidas(o).map((m) => m.dictado_id));
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

      // El resto del onboarding (tour guiado, progreso anterior, notas)
      // vive fuera de este wizard. progreso-anterior necesita saber qué
      // semestre(s) se está cursando ahora para no volver a preguntar por
      // ellos — semestresElegidos es estado local de este wizard, así que
      // viaja como string (param de navegación / arg de tour.iniciar) en
      // vez de persistirse en la base.
      const semestresParam = JSON.stringify(semestresElegidos);
      if (catalogoConHorario === false) {
        // Carreras sin horario en catálogo: primero se ofrece cargar el
        // horario materia por materia (app/onboarding/horario.tsx); sin
        // tour, el usuario nunca pasó por un catálogo con grupos/dictados.
        // Navegar ANTES de refrescar: horario/progreso-anterior están
        // permitidas con o sin materias, así que el gate de _layout.tsx no
        // tiene nada que hacer; al revés, el status nuevo (ya con materias)
        // podía llegar con la ruta todavía en /wizard y el gate lo mandaba
        // un instante a Inicio.
        router.replace({ pathname: "/onboarding/horario", params: { semestres: semestresParam } });
        await status.refresh();
      } else {
        // Acá sí primero el status: sin materias en el contexto, el gate
        // rebotaría /(tabs) de vuelta a /onboarding.
        await status.refresh();
        // ORT-like: el tour es un overlay global (ver TourProvider en
        // app/_layout.tsx), no una ruta — corre sobre las tabs reales para
        // poder resaltarlas. Al terminar/saltar, el propio contexto navega
        // a /onboarding/progreso-anterior con este mismo semestresParam.
        tour.iniciar(PASOS_TOUR, semestresParam);
        router.replace("/(tabs)");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aplicar la selección — intentá de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  const handleContinuar = async () => {
    setError(null);
    const pasoActualIdx = PASOS.indexOf(paso);
    if (paso === "universidad") {
      const esOtra = universidadId === "otra";
      if (!universidadId) {
        setError("Elegí tu universidad para continuar.");
        return;
      }
      if (esOtra && !universidadOtra.trim()) {
        setError("Escribí el nombre de tu universidad.");
        return;
      }
      setBusy(true);
      try {
        if (!userId) throw new Error("No hay sesión.");
        const { error: upErr } = await supabase.from("profiles").upsert({
          id: userId,
          university_id: esOtra ? null : universidadId,
          university_other: esOtra ? universidadOtra.trim() : null,
        });
        if (upErr) throw upErr;
        // OJO: no llamar status.refresh() acá si nos quedamos en el wizard
        // (rama normal, más abajo) — RootLayoutNav devuelve null mientras
        // status.loading es true, lo que desmonta el wizard entero y pierde
        // pasoIdx/universidadId (bug real: "no me deja pasar de universidad").
        // Sólo hace falta refrescar antes de las dos salidas hacia
        // /onboarding (acá abajo si es "Otra", y en el efecto de arriba si
        // la universidad no tiene catálogo) — ahí sí conviene, porque de
        // todos modos el wizard se desmonta al navegar afuera.
        if (esOtra) await status.refresh();
      } catch (e) {
        setBusy(false);
        setError(e instanceof Error ? e.message : "No se pudo guardar tu universidad — revisá tu conexión e intentá de nuevo.");
        return;
      }
      setBusy(false);
      if (esOtra) {
        router.replace("/onboarding");
        return;
      }
      setPasoIdx(pasoActualIdx + 1);
    } else if (paso === "carrera") {
      if (!carreraId) {
        setError("Elegí tu carrera para continuar.");
        return;
      }
      setBusy(true);
      try {
        if (!userId) throw new Error("No hay sesión.");
        const { error: upErr } = await supabase.from("profiles").upsert({ id: userId, carrera_id: carreraId });
        if (upErr) throw upErr;
        const dictadosProbe = await catDictados(carreraId, PERIODO_ACTUAL).catch(() => []);
        setCatalogoConHorario(dictadosProbe.length > 0);
      } catch (e) {
        setBusy(false);
        setError(e instanceof Error ? e.message : "No se pudo guardar tu carrera — revisá tu conexión e intentá de nuevo.");
        return;
      }
      setBusy(false);
      setPasoIdx(pasoActualIdx + 1);
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
      setPasoIdx(pasoActualIdx + 1);
      await cargarOferta();
    } else if (paso === "oferta") {
      const siguiente = PASOS[pasoActualIdx + 1];
      setPasoIdx(pasoActualIdx + 1);
      if (siguiente === "electivas") {
        const turnoDefault = inferirTurnoElectivas();
        setElectivaTurno(turnoDefault);
        await cargarElectivas(turnoDefault);
      } else {
        await cargarRevision();
      }
    } else if (paso === "electivas") {
      setPasoIdx(pasoActualIdx + 1);
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
    // Sin esto, eligibleForWizard seguía en true (nunca se llegó a elegir
    // carrera_id): apenas se tocaba una tab que no fuera Materias,
    // needsOnboarding mandaba de vuelta a /onboarding, que reenviaba
    // derecho al wizard de nuevo — el "Prefiero cargarlo a mano" no
    // sacaba de verdad del wizard (loop reportado).
    status.marcarModoManual();
    router.replace("/(tabs)/materias");
  };

  const items = useMemo(() => {
    const out: { id: string; nombre: string; salon: string | null; bloques: Bloque[] }[] = [];
    Object.values(ofertaPorSemestre).forEach((o) => {
      if (o.modo === "grupo") grupoElegidas(o).forEach((m) => out.push({ id: m.dictado_id, nombre: m.nombre, salon: m.salon, bloques: m.bloques }));
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

        {paso === "universidad" ? (
          <View style={{ gap: spacing.sm }}>
            {!universidades ? (
              <AppText style={{ fontSize: 14, color: colors.textTertiary }}>Cargando universidades…</AppText>
            ) : (
              <>
                {universidades.map((u) => (
                  <PressableScale
                    key={u.id}
                    scaleTo={0.98}
                    onPress={() => setUniversidadId(u.id)}
                    style={{
                      padding: spacing.lg,
                      borderRadius: radii.md,
                      backgroundColor: universidadId === u.id ? colors.accentSoft : colors.surface,
                      borderWidth: universidadId === u.id ? 1.5 : 0,
                      borderColor: colors.accent,
                    }}
                  >
                    <AppText weight="600" style={{ fontSize: 15 }}>
                      {u.nombre}
                    </AppText>
                  </PressableScale>
                ))}
                <PressableScale
                  scaleTo={0.98}
                  onPress={() => setUniversidadId("otra")}
                  style={{
                    padding: spacing.lg,
                    borderRadius: radii.md,
                    backgroundColor: universidadId === "otra" ? colors.accentSoft : colors.surface,
                    borderWidth: universidadId === "otra" ? 1.5 : 0,
                    borderColor: colors.accent,
                  }}
                >
                  <AppText weight="600" style={{ fontSize: 15 }}>
                    Otra…
                  </AppText>
                </PressableScale>
                {universidadId === "otra" ? (
                  <TextInput
                    style={{
                      height: 50,
                      borderRadius: radii.sm,
                      backgroundColor: colors.surface,
                      paddingHorizontal: spacing.lg,
                      fontSize: 15,
                      color: colors.text,
                    }}
                    placeholder="Nombre de tu universidad"
                    placeholderTextColor={colors.textFaint}
                    value={universidadOtra}
                    onChangeText={setUniversidadOtra}
                  />
                ) : null}
              </>
            )}
          </View>
        ) : null}

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
                          {o.grupos.map((g) => {
                            const abierto = o.grupoIds.includes(g.id);
                            const materiasGrupo = o.materiasPorGrupo[g.id];
                            const cargando = abierto && !materiasGrupo;
                            const elegidas = materiasGrupo ? materiasGrupo.filter((m) => !o.grupoExcluidos.includes(m.dictado_id)).length : 0;
                            const meta = [g.turno, g.edificio, `${g.materias} ${g.materias === 1 ? "materia" : "materias"}`].filter(Boolean).join(" · ");
                            return (
                              <View
                                key={g.id}
                                style={{
                                  borderRadius: radii.md,
                                  backgroundColor: abierto ? colors.accentSoft : colors.surface,
                                  borderWidth: abierto ? 1.5 : 0,
                                  borderColor: colors.accent,
                                  overflow: "hidden",
                                }}
                              >
                                <PressableScale
                                  scaleTo={0.98}
                                  onPress={() => alternarGrupo(s, g)}
                                  accessibilityRole="button"
                                  accessibilityState={{ expanded: abierto }}
                                  style={{ padding: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.sm }}
                                >
                                  <View style={{ flex: 1, gap: 1 }}>
                                    <AppText weight="600" style={{ fontSize: 14 }}>
                                      {g.codigo}
                                    </AppText>
                                    <AppText style={{ fontSize: 12, color: colors.textTertiary }}>
                                      {abierto && materiasGrupo?.length ? `${meta} · cursás ${elegidas} de ${materiasGrupo.length}` : meta}
                                    </AppText>
                                  </View>
                                  <AppIcon name={abierto ? "chevron-up" : "chevron-down"} size={16} color={colors.textTertiary} />
                                </PressableScale>
                                {abierto ? (
                                  <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
                                    {cargando ? (
                                      <AppText style={{ fontSize: 12, color: colors.textFaint, paddingVertical: spacing.sm }}>Cargando materias…</AppText>
                                    ) : !materiasGrupo?.length ? (
                                      <AppText style={{ fontSize: 12, color: colors.textFaint, paddingVertical: spacing.sm }}>Este grupo no tiene materias con horario cargado.</AppText>
                                    ) : (
                                      <>
                                        <AppText style={{ fontSize: 12, color: colors.textTertiary, paddingBottom: 2 }}>Destildá las que no estés cursando.</AppText>
                                        {materiasGrupo.map((m) => {
                                          const on = !o.grupoExcluidos.includes(m.dictado_id);
                                          return (
                                            <PressableScale
                                              key={m.dictado_id}
                                              scaleTo={0.98}
                                              onPress={() =>
                                                setOfertaPorSemestre((prev) => ({ ...prev, [s]: { ...prev[s], grupoExcluidos: toggle(prev[s].grupoExcluidos, m.dictado_id) } }))
                                              }
                                              accessibilityRole="checkbox"
                                              accessibilityState={{ checked: on }}
                                              style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm }}
                                            >
                                              <AppIcon name={on ? "checkbox" : "square-outline"} size={20} color={on ? colors.accent : colors.textFaint} />
                                              <View style={{ flex: 1, gap: 1, opacity: on ? 1 : 0.5 }}>
                                                <AppText weight="500" style={{ fontSize: 13 }}>
                                                  {m.nombre}
                                                </AppText>
                                                <AppText style={{ fontSize: 11, color: colors.textFaint }}>{[m.salon, formatHorario(m.bloques)].filter(Boolean).join(" · ")}</AppText>
                                              </View>
                                            </PressableScale>
                                          );
                                        })}
                                      </>
                                    )}
                                  </View>
                                ) : null}
                              </View>
                            );
                          })}
                          <PressableScale
                            scaleTo={0.98}
                            onPress={() => setOfertaPorSemestre((prev) => ({ ...prev, [s]: { ...prev[s], modo: "manual" } }))}
                          >
                            <AppText weight="500" style={{ fontSize: 12, color: colors.accentText }}>
                              Ninguno me sirve, elegir materias sueltas
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
                                const on = o.manualIds.includes(d.dictado_id);
                                return (
                                  <PressableScale
                                    key={d.dictado_id}
                                    scaleTo={0.98}
                                    onPress={() => setOfertaPorSemestre((prev) => ({ ...prev, [s]: { ...prev[s], manualIds: toggle(prev[s].manualIds, d.dictado_id) } }))}
                                    style={{
                                      padding: spacing.md,
                                      borderRadius: radii.md,
                                      backgroundColor: on ? colors.accentSoft : colors.surface,
                                      borderWidth: on ? 1.5 : 0,
                                      borderColor: colors.accent,
                                      gap: 2,
                                    }}
                                  >
                                    <AppText weight="600" style={{ fontSize: 13 }}>
                                      {d.nombre}
                                    </AppText>
                                    <AppText style={{ fontSize: 11, color: colors.textFaint }}>
                                      {[d.grupo, d.turno, d.salon, formatHorario(d.bloques)].filter(Boolean).join(" · ")}
                                    </AppText>
                                  </PressableScale>
                                );
                              })
                          ) : (
                            <>
                              <AppText style={{ fontSize: 12, color: colors.textFaint, fontStyle: "italic" }}>
                                Sin horario cargado en el catálogo todavía — elegí las materias y completá el horario vos después.
                              </AppText>
                              {o.sugeridas.map((m) => {
                                const on = o.sinHorarioIds.includes(m.materia_id);
                                return (
                                  <PressableScale
                                    key={m.materia_id}
                                    scaleTo={0.98}
                                    onPress={() =>
                                      setOfertaPorSemestre((prev) => ({ ...prev, [s]: { ...prev[s], sinHorarioIds: toggle(prev[s].sinHorarioIds, m.materia_id) } }))
                                    }
                                    style={{
                                      padding: spacing.md,
                                      borderRadius: radii.md,
                                      backgroundColor: on ? colors.accentSoft : colors.surface,
                                      borderWidth: on ? 1.5 : 0,
                                      borderColor: colors.accent,
                                      gap: 2,
                                    }}
                                  >
                                    <AppText weight="600" style={{ fontSize: 13 }}>
                                      {m.nombre}
                                    </AppText>
                                    <AppText style={{ fontSize: 11, color: colors.textFaint }}>
                                      {(m.creditos ? `${m.creditos} créditos` : "") + (m.obligatoria === false ? " · electiva de plan" : "")}
                                    </AppText>
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
                const motivo = e.estado === "sin_minimo" ? "No se abrió por falta de inscriptos." : null;
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

      {/* Confirmar crea materias, agenda y reconcilia en varias llamadas:
          loader de marca en vez de un botón deshabilitado sin feedback. */}
      {busy && paso === "revision" ? <LoadingScreen overlay label="Armando tu semestre…" /> : null}
    </SafeAreaView>
  );
}
