import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, RefreshControl, ScrollView, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText, BackButton, PressableScale, PrimaryButton, Reveal, Spotlight } from "@/components/ui";
import { useAsistencia } from "@/hooks/AsistenciaContext";
import { Card, SectionTitle } from "@/components/asistencia/Card";
import { AsistenciaLeyenda } from "@/components/asistencia/AsistenciaGlyph";
import { DiaPanel } from "@/components/asistencia/DiaPanel";
import { MateriaFilas } from "@/components/asistencia/MateriaFilas";
import { MesCalendario } from "@/components/asistencia/MesCalendario";
import { PendientesBanner } from "@/components/asistencia/PendientesBanner";
import { PeriodoNav } from "@/components/asistencia/PeriodoNav";
import { ResumenPeriodo, type Comparacion } from "@/components/asistencia/ResumenPeriodo";
import { SemanaTira, type DiaTira } from "@/components/asistencia/SemanaTira";
import { SemestreBarras } from "@/components/asistencia/SemestreBarras";
import {
  addDias,
  deltaPct,
  desplazarAncla,
  diasDelPeriodo,
  diasPendientes,
  esMismoDia,
  fechaDeISO,
  formatMesAnio,
  formatRangoFechas,
  inicioDelDia,
  inicioSeguimiento,
  lunesDe,
  periodoAnterior,
  periodoDe,
  porMateria,
  resumir,
  serieSemanal,
  sesionesDelDia,
  sesionesDelPeriodo,
  toISODate,
  type AsistenciaEstado,
  type AsistenciaRango,
  type Sesion,
} from "@/lib/asistencia";

const RANGOS: { key: AsistenciaRango; label: string }[] = [
  { key: "semana", label: "Semana" },
  { key: "mes", label: "Mes" },
  { key: "semestre", label: "Semestre" },
];

function RangoToggle({ valor, onChange }: { valor: AsistenciaRango; onChange: (r: AsistenciaRango) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ height: 40, borderRadius: radii.sm, backgroundColor: colors.surfaceSofter, padding: 3, flexDirection: "row", gap: 3 }} accessibilityRole="tablist">
      {RANGOS.map((r) => {
        const activo = valor === r.key;
        return (
          <PressableScale
            key={r.key}
            scaleTo={0.98}
            onPress={() => onChange(r.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activo }}
            style={{ flex: 1, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: activo ? colors.text : "transparent" }}
          >
            <AppText weight={activo ? "600" : "500"} style={{ fontSize: 14, color: activo ? colors.bg : colors.textSecondary }}>
              {r.label}
            </AppText>
          </PressableScale>
        );
      })}
    </View>
  );
}

function Esqueleto() {
  const { colors } = useTheme();
  const bloque = (alto: number) => <View style={{ height: alto, borderRadius: radii.lg, backgroundColor: colors.surface }} />;
  return (
    <View style={{ paddingHorizontal: spacing.xl, gap: spacing.xl }} accessibilityLabel="Cargando asistencia" accessibilityRole="progressbar">
      {bloque(40)}
      {bloque(124)}
      {bloque(240)}
    </View>
  );
}

function EstadoCentrado({ titulo, texto, accion, onAccion }: { titulo: string; texto: string; accion: string; onAccion: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", gap: spacing.lg, paddingTop: spacing.xxxl * 2, paddingHorizontal: spacing.xl }}>
      <View style={{ alignItems: "center", gap: spacing.xs }}>
        <AppText weight="600" style={{ fontSize: 17 }}>
          {titulo}
        </AppText>
        <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", lineHeight: 20 }}>{texto}</AppText>
      </View>
      <PrimaryButton label={accion} onPress={onAccion} style={{ alignSelf: "stretch" }} />
    </View>
  );
}

export default function AsistenciaScreen() {
  const { colors } = useTheme();
  const { listo, error, semestre, materias, registros, refetch, marcar, marcarVarias, desmarcar } = useAsistencia();

  // "Ahora" se refresca al volver a la app y al enfocar la pantalla: una
  // clase que terminó mientras tanto pasa de "todavía no" a "sin registrar".
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setAhora(new Date());
    });
    return () => sub.remove();
  }, []);
  useFocusEffect(
    useCallback(() => {
      setAhora(new Date());
      void refetch();
    }, [refetch])
  );

  const [rango, setRango] = useState<AsistenciaRango>("semestre");
  const [ancla, setAncla] = useState(() => inicioDelDia(new Date()));
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [semanaSel, setSemanaSel] = useState<number | null>(null);
  const [refrescando, setRefrescando] = useState(false);

  const hoy = useMemo(() => inicioDelDia(ahora), [ahora]);
  const ids = useMemo(() => new Set(materias.map((m) => m.id)), [materias]);
  // El semestre no tiene fecha de inicio en la base: arranca en el primer
  // registro (ver inicioSeguimiento).
  const inicio = useMemo(() => inicioSeguimiento(registros, ids, hoy), [registros, ids, hoy]);
  const periodo = useMemo(() => periodoDe(rango, ancla, inicio, hoy), [rango, ancla, inicio, hoy]);

  const sesiones = useMemo(() => sesionesDelPeriodo(materias, registros, periodo, ahora), [materias, registros, periodo, ahora]);
  const stats = useMemo(() => resumir(sesiones), [sesiones]);
  const filas = useMemo(() => porMateria(materias, sesiones), [materias, sesiones]);
  const serie = useMemo(() => (rango === "semestre" ? serieSemanal(sesiones, periodo) : []), [rango, sesiones, periodo]);

  const sesionesPorDia = useMemo(() => {
    const mapa = new Map<string, Sesion[]>();
    for (const s of sesiones) {
      const g = mapa.get(s.fecha);
      if (g) g.push(s);
      else mapa.set(s.fecha, [s]);
    }
    return mapa;
  }, [sesiones]);

  const comparacion = useMemo<Comparacion | null>(() => {
    const anterior = periodoAnterior(rango, periodo);
    if (!anterior) return null;
    const puntos = deltaPct(stats.pct, resumir(sesionesDelPeriodo(materias, registros, anterior, ahora)).pct);
    return puntos == null ? null : { puntos, contra: rango === "semana" ? "semana anterior" : "mes anterior" };
  }, [rango, periodo, stats.pct, materias, registros, ahora]);

  // Lo que se le pide activamente al usuario (mismo criterio que el aviso
  // diario): últimos 14 días, del más viejo al más nuevo.
  const pendientesDias = useMemo(() => diasPendientes(materias, registros, hoy, 14, ahora), [materias, registros, hoy, ahora]);
  const pendientesCantidad = useMemo(
    () => pendientesDias.reduce((n, f) => n + sesionesDelDia(materias, registros, f, ahora).filter((s) => s.estado === "pendiente").length, 0),
    [pendientesDias, materias, registros, ahora]
  );

  const diasTira = useMemo<DiaTira[]>(() => {
    if (rango !== "semana") return [];
    // Lunes a viernes siempre; sábado y domingo sólo si tuvieron clases.
    return diasDelPeriodo(periodo)
      .filter((f) => (f.getDay() >= 1 && f.getDay() <= 5) || (sesionesPorDia.get(toISODate(f))?.length ?? 0) > 0)
      .map((f) => ({ fecha: f, iso: toISODate(f), sesiones: sesionesPorDia.get(toISODate(f)) ?? [] }));
  }, [rango, periodo, sesionesPorDia]);

  // El día elegido sólo vale dentro del período a la vista (al cambiar de
  // semana o de mes deja de aplicar) y no en el semestre, que no tiene días.
  const seleccionActiva = rango !== "semestre" && seleccion && seleccion >= toISODate(periodo.desde) && seleccion <= toISODate(periodo.hasta) ? seleccion : null;
  const sesionesSel = useMemo(
    () => (seleccionActiva ? sesionesDelDia(materias, registros, fechaDeISO(seleccionActiva), ahora) : []),
    [seleccionActiva, materias, registros, ahora]
  );
  const otrosPendientes = useMemo(() => pendientesDias.filter((f) => toISODate(f) !== seleccionActiva), [pendientesDias, seleccionActiva]);

  // ---- navegación ----
  const elegirRango = (r: AsistenciaRango) => {
    setRango(r);
    setAncla(hoy);
    setSeleccion(null);
  };
  const mover = (paso: number) => {
    setAncla(desplazarAncla(rango, ancla, paso));
    setSeleccion(null);
  };
  const irADia = (fecha: Date) => {
    setRango("semana");
    setAncla(fecha);
    setSeleccion(toISODate(fecha));
  };
  const verSemana = (lunes: Date) => {
    setRango("semana");
    setAncla(lunes);
    setSeleccion(null);
  };
  const completar = () => {
    if (pendientesDias[0]) irADia(pendientesDias[0]);
  };
  const siguientePendiente = () => {
    const despues = otrosPendientes.find((f) => seleccionActiva != null && toISODate(f) > seleccionActiva) ?? otrosPendientes[0];
    if (despues) irADia(despues);
  };

  // ---- edición del día elegido ----
  const marcarDia = (materiaId: string, estado: AsistenciaEstado | null) => {
    if (!seleccionActiva) return;
    void (estado == null ? desmarcar(seleccionActiva, materiaId) : marcar(seleccionActiva, materiaId, estado));
  };
  const marcarTodas = () => {
    if (!seleccionActiva) return;
    const faltan = sesionesSel.filter((s) => s.estado === "pendiente" || s.estado === "futuro");
    void marcarVarias(faltan.map((s) => ({ fecha: seleccionActiva, materiaId: s.materia.id, estado: "asistio" as const })));
  };

  // Al elegir un día, si el editor quedó fuera de la vista (calendario alto),
  // se lo trae — sin mover nada si ya se ve.
  const scrollRef = useRef<ScrollView>(null);
  const panelY = useRef(0);
  const scrollY = useRef(0);
  const altoVista = useRef(0);
  useEffect(() => {
    if (!seleccionActiva) return;
    const t = setTimeout(() => {
      const fueraDeVista = panelY.current > scrollY.current + altoVista.current - 160 || panelY.current < scrollY.current;
      if (fueraDeVista) scrollRef.current?.scrollTo({ y: Math.max(0, panelY.current - 24), animated: true });
    }, 60);
    return () => clearTimeout(t);
  }, [seleccionActiva]);

  const refrescar = async () => {
    setRefrescando(true);
    await refetch();
    setRefrescando(false);
  };

  // ---- estados de la pantalla ----
  const sinRegistros = Object.keys(registros).length === 0;
  const sinHorario = listo && sinRegistros && !materias.some((m) => m.estado === "cursando" && m.bloques.length > 0);
  const semestreVacio = rango === "semestre" && stats.presentes + stats.faltas + stats.sinClase === 0;

  const esActual = rango === "semana" ? toISODate(lunesDe(ancla)) === toISODate(lunesDe(hoy)) : ancla.getFullYear() === hoy.getFullYear() && ancla.getMonth() === hoy.getMonth();
  const siguienteDeshabilitado = rango === "semana" ? addDias(lunesDe(ancla), 7).getTime() > hoy.getTime() : new Date(ancla.getFullYear(), ancla.getMonth() + 1, 1).getTime() > hoy.getTime();
  const tituloPeriodo = rango === "semana" ? formatRangoFechas(periodo.desde, periodo.hasta) : formatMesAnio(ancla);
  // Sin elección previa arranca en la última semana con datos: la actual
  // suele estar vacía (recién empieza) y abrir en "sin registros" no informa.
  const ultimaConDatos = serie.reduce((ultima, p, i) => (p.stats.total > 0 ? i : ultima), serie.length - 1);
  const semanaElegida = Math.min(semanaSel ?? ultimaConDatos, serie.length - 1);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <Spotlight height={280} />
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <BackButton />
        <View>
          <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2 }} accessibilityRole="header">
            Asistencia
          </AppText>
          {semestre?.nombre ? <AppText style={{ fontSize: 12, color: colors.textTertiary }}>{semestre.nombre}</AppText> : null}
        </View>
      </View>

      {!listo && error ? (
        <EstadoCentrado titulo="No se pudo cargar la asistencia" texto="Revisá tu conexión e intentá de nuevo." accion="Reintentar" onAccion={() => void refetch()} />
      ) : !listo ? (
        <Esqueleto />
      ) : sinHorario ? (
        <EstadoCentrado
          titulo="Todavía no hay clases para registrar"
          texto="Cargá el horario de tus materias y las clases van a aparecer acá para que registres tu asistencia."
          accion="Ir a Materias"
          onAccion={() => router.push("/(tabs)/materias")}
        />
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl }}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={32}
          onScroll={(e) => {
            scrollY.current = e.nativeEvent.contentOffset.y;
          }}
          onLayout={(e) => {
            altoVista.current = e.nativeEvent.layout.height;
          }}
          refreshControl={<RefreshControl refreshing={refrescando} onRefresh={refrescar} tintColor={colors.textTertiary} />}
        >
          <Reveal style={{ gap: spacing.xl }}>
            {pendientesCantidad > 0 ? <PendientesBanner cantidad={pendientesCantidad} onCompletar={completar} /> : null}

            <View style={{ gap: spacing.md }}>
              <RangoToggle valor={rango} onChange={elegirRango} />
              {rango !== "semestre" ? (
                <PeriodoNav
                  titulo={tituloPeriodo}
                  labelAnterior={rango === "semana" ? "Semana anterior" : "Mes anterior"}
                  labelSiguiente={rango === "semana" ? "Semana siguiente" : "Mes siguiente"}
                  onAnterior={() => mover(-1)}
                  onSiguiente={() => mover(1)}
                  siguienteDeshabilitado={siguienteDeshabilitado}
                  volver={esActual ? undefined : { label: rango === "semana" ? "Ir a esta semana" : "Ir a este mes", onPress: () => elegirRango(rango) }}
                />
              ) : null}
            </View>

            {semestreVacio ? (
              <Card gap={spacing.md}>
                <AppText weight="600" style={{ fontSize: 16 }}>
                  Todavía no registraste asistencia
                </AppText>
                <AppText style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 19 }}>
                  Cuando marques tus clases, acá vas a ver cómo viene el semestre semana a semana.
                </AppText>
                <PrimaryButton label="Registrar clases" onPress={() => (pendientesDias[0] ? completar() : elegirRango("semana"))} />
              </Card>
            ) : (
              <ResumenPeriodo
                stats={stats}
                comparacion={comparacion}
                vacio="Tocá un día para registrar tus clases."
                onVerPendientes={
                  stats.pendientes > 0
                    ? () => {
                        const primero = sesiones.find((s) => s.estado === "pendiente");
                        if (primero) irADia(fechaDeISO(primero.fecha));
                      }
                    : undefined
                }
              />
            )}

            {rango === "semana" ? (
              <Card gap={spacing.sm}>
                <SemanaTira dias={diasTira} hoy={hoy} seleccion={seleccionActiva} onSeleccionar={(iso) => setSeleccion(seleccion === iso ? null : iso)} />
                <AsistenciaLeyenda />
              </Card>
            ) : null}

            {rango === "mes" ? (
              <Card gap={spacing.sm}>
                <MesCalendario mes={ancla} sesionesPorDia={sesionesPorDia} hoy={hoy} seleccion={seleccionActiva} onSeleccionar={(iso) => setSeleccion(seleccion === iso ? null : iso)} />
                <AsistenciaLeyenda />
              </Card>
            ) : null}

            {rango === "semestre" && !semestreVacio ? (
              <View>
                <SectionTitle>Por semana</SectionTitle>
                <Card>
                  <SemestreBarras semanas={serie} seleccion={semanaElegida} onSeleccionar={setSemanaSel} onVerSemana={verSemana} />
                </Card>
              </View>
            ) : null}

            {seleccionActiva ? (
              <View
                onLayout={(e) => {
                  panelY.current = e.nativeEvent.layout.y;
                }}
              >
                <DiaPanel
                  fecha={fechaDeISO(seleccionActiva)}
                  esHoy={esMismoDia(fechaDeISO(seleccionActiva), hoy)}
                  sesiones={sesionesSel}
                  hayOtrosPendientes={otrosPendientes.length > 0}
                  onMarcar={marcarDia}
                  onMarcarTodas={marcarTodas}
                  onSiguiente={siguientePendiente}
                  onCerrar={() => setSeleccion(null)}
                />
              </View>
            ) : null}

            {filas.length > 0 && !semestreVacio ? (
              <View>
                <SectionTitle>Por materia</SectionTitle>
                <Card gap={0}>
                  <MateriaFilas items={filas} modo={rango === "semana" ? "marcas" : "barra"} onAbrir={(id) => router.push(`/materia/${id}`)} />
                </Card>
              </View>
            ) : null}
          </Reveal>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
