import { useEffect, useMemo, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { Alert, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import type { Materia } from "@/types/database";
import { colors, estadoLabel, estadoTone, materiaColors, radii, spacing, tone, type Tone } from "@/theme/tokens";
import { AppText, BackButton, BottomSheet, Pill, PressableScale, PrimaryButton, ProgressRing, RangeSlider } from "@/components/ui";
import { demoMaterias, type DemoAsistenciaRango, type DemoEvaluacion, type DemoMateria } from "@/data/demoContent";
import { DIAS_BLOQUE, horaTexto } from "@/lib/catalog";
import { today } from "@/lib/agenda";
import { calcularSimulacion, escalaLabel, formatValor, toRow, unidad, type ComponenteFijoSim, type EvaluacionSim } from "@/lib/materias";
import { rowToDemoEvaluacion, useAgenda } from "@/hooks/useAgenda";

function isoToday() {
  return today().toISOString().slice(0, 10);
}

type RangoAsistencia = "semana" | "mes" | "semestre";

function materiaAbrev(nombre: string) {
  return (nombre.trim().split(/\s+/)[0] ?? "").slice(0, 4).toUpperCase();
}

// Callout de estado de aprobación — puerto directo de las 5 ramas de
// renderDetalle() (runtime.js): aprobada / debe-rendir-examen / sin-notas /
// vas-aprobando(-raspando) / te-faltan-X.
function calloutDe(m: DemoMateria): { titulo: string; texto: string } {
  // "count" son notas YA CARGADAS (evaluaciones con estado "aprobada"), no
  // el total de ítems — de ahí depende si dice "Debés rendir examen" /
  // "Todavía no cargaste notas" y el "con N notas cargadas" del texto.
  const count = m.evaluaciones.filter((e) => e.estado === "aprobada").length;
  const aprobTxt = `${formatValor(m.escalaAprob, m.escalaTotal)}${unidad(m.escalaTotal)}`;
  const exonTxt = m.escalaExon != null ? `${formatValor(m.escalaExon, m.escalaTotal)}${unidad(m.escalaTotal)}` : null;
  const escalaTxt = escalaLabel(m.escalaTotal).toLowerCase();
  const totalTxt = `${formatValor(m.escalaTotal, m.escalaTotal)}${unidad(m.escalaTotal)}`;

  if (m.estado === "aprobada") {
    return { titulo: "Ya aprobaste esta materia", texto: `Se calificó por ${escalaTxt} sobre ${totalTxt} y aprobaba con ${aprobTxt}.` };
  }
  if (m.estado === "pendiente" && !count) {
    return {
      titulo: "Debés rendir examen",
      texto: `Cursaste esta materia pero todavía te falta el examen. El examen aprueba con ${aprobTxt}. Cargá la nota con "Cargar nota" — si llega al mínimo, la materia pasa a Aprobada sola.`,
    };
  }
  if (!count) {
    return {
      titulo: "Todavía no cargaste notas",
      texto: `Esta materia se califica por ${escalaTxt} sobre ${totalTxt} y aprueba con ${aprobTxt}.${exonTxt ? ` Exonera con ${exonTxt}.` : ""} Agregá tu primer parcial para ver la proyección.`,
    };
  }
  if (m.promedio >= m.escalaAprob) {
    return {
      titulo: m.tone === "warning" ? "Vas aprobando, pero raspando" : "Vas aprobando esta materia",
      texto: `Esta materia se califica por ${escalaTxt} sobre ${totalTxt} y aprueba con ${aprobTxt}. Con ${count} ${count === 1 ? "nota cargada" : "notas cargadas"} tu promedio es ${formatValor(m.promedio, m.escalaTotal)}${unidad(m.escalaTotal)}, por encima del mínimo.`,
    };
  }
  const necesita = `${formatValor(m.escalaAprob - m.promedio, m.escalaTotal)}${unidad(m.escalaTotal)}`;
  return {
    titulo: `Te faltan ${necesita} para llegar a la aprobación`,
    texto: `Esta materia se califica por ${escalaTxt} sobre ${totalTxt} y aprueba con ${aprobTxt}. Con ${count} ${count === 1 ? "nota cargada" : "notas cargadas"} tu promedio es ${formatValor(m.promedio, m.escalaTotal)}${unidad(m.escalaTotal)}, así que te faltan ${necesita} para llegar al mínimo.`,
  };
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.xl, gap: spacing.lg }}>{children}</View>;
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
      <AppText weight="600" style={{ fontSize: 17, letterSpacing: -0.2 }}>
        {children}
      </AppText>
      {hint ? (
        <AppText mono style={{ fontSize: 12, color: colors.textTertiary }}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export default function MateriaDetalleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [supaMateria, setSupaMateria] = useState<Materia | null>(null);
  const [simuladorAbierto, setSimuladorAbierto] = useState(false);
  const [valoresSimulados, setValoresSimulados] = useState<Record<string, number>>({});
  const [rangoAsistencia, setRangoAsistencia] = useState<RangoAsistencia>("semana");
  const [cargarNotaAbierto, setCargarNotaAbierto] = useState(false);
  const [notaInputs, setNotaInputs] = useState<Record<string, string>>({});
  const [accionItem, setAccionItem] = useState<DemoEvaluacion | null>(null);
  const [crearItemTipo, setCrearItemTipo] = useState<"evaluacion" | "tarea" | null>(null);
  const [crearItemTitulo, setCrearItemTitulo] = useState("");

  useEffect(() => {
    if (!id) return;
    supabase
      .from("materias")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => setSupaMateria(data ?? null));
  }, [id]);

  const materia = useMemo<DemoMateria>(() => {
    if (supaMateria) return toRow(supaMateria);
    return demoMaterias.find((m) => m.id === id) ?? demoMaterias[0];
  }, [supaMateria, id]);

  // "Evaluaciones y tareas" lee/escribe la misma tabla real `agenda` que
  // Agenda (ver src/hooks/useAgenda.ts), acotada a esta materia. Si el
  // usuario todavía no tiene ninguna fila para esta materia, se muestra la
  // de muestra en su lugar (mismo criterio que Materias) — estado local
  // editable sólo para ese caso demo.
  const agenda = useAgenda(materia.id);
  const usandoDemoEvals = !agenda.hasRows;
  const [demoEvaluaciones, setDemoEvaluaciones] = useState<DemoEvaluacion[]>(materia.evaluaciones);

  // Se resetea si cambia de materia.
  useEffect(() => {
    setDemoEvaluaciones(materia.evaluaciones);
    setValoresSimulados({});
    setSimuladorAbierto(false);
  }, [materia]);

  const evaluaciones = useMemo<DemoEvaluacion[]>(
    () => (usandoDemoEvals ? demoEvaluaciones : (agenda.rows ?? []).map((r) => rowToDemoEvaluacion(r, materia.escalaTotal))),
    [usandoDemoEvals, demoEvaluaciones, agenda.rows, materia.escalaTotal]
  );

  const accent = materiaColors[materia.colorId];
  const t = tone[materia.tone];
  const notaTxt = materia.promedio > 0 ? formatValor(materia.promedio, materia.escalaTotal) : "—";
  const pct = materia.promedio > 0 ? Math.max(0, Math.min(1, materia.promedio / materia.escalaTotal)) : 0;
  const callout = calloutDe({ ...materia, evaluaciones });

  const evaluacionesSim: EvaluacionSim[] = evaluaciones.map((e) => ({
    id: e.id,
    notaMaxima: e.notaMax,
    nota: e.estado === "aprobada" ? e.nota ?? null : null,
  }));
  const componentesFijosSim: ComponenteFijoSim[] = materia.componentesFijos.map((c) => ({ id: c.id, puntajeMax: c.puntajeMax, valor: c.valor }));
  const sim = calcularSimulacion({ total: materia.escalaTotal, aprob: materia.escalaAprob, exoneracion: materia.escalaExon ?? null }, evaluacionesSim, valoresSimulados, componentesFijosSim);

  const evaluacionesSinNota = evaluaciones.filter((e) => e.estado === "pendiente");
  const fijosSinValor = materia.componentesFijos.filter((c) => c.valor == null);
  const haySimulable = evaluacionesSinNota.length > 0 || fijosSinValor.length > 0;
  const simPct = sim.total > 0 ? Math.max(0, Math.min(1, sim.puntosProyectados / sim.total)) : 0;
  const simTone: Tone = sim.asegurado ? "success" : sim.imposible ? "danger" : sim.faltanAprobacion === 0 ? "success" : "warning";

  const notasList = evaluaciones.filter((e) => e.estado === "aprobada");

  const pendientesEvals = evaluaciones.filter((e) => e.estado === "pendiente");
  const completadasEvals = evaluaciones.filter((e) => e.estado === "aprobada");

  const bloquesPorDia = new Map(materia.bloques.map((b) => [b.dia, b]));
  const asistenciaActual: DemoAsistenciaRango | null = materia.asistencia ? materia.asistencia[rangoAsistencia] : null;

  const stub = (titulo: string) => Alert.alert(titulo, "Esta acción llega en una próxima iteración.");
  const avisarError = (titulo: string) => Alert.alert(titulo, "Revisá tu conexión e intentá de nuevo.");

  const abrirCargarNota = () => {
    if (!pendientesEvals.length) {
      stub("Cargar nota");
      return;
    }
    setNotaInputs({});
    setCargarNotaAbierto(true);
  };

  const guardarNotas = async () => {
    const cambios = pendientesEvals
      .map((e) => {
        const raw = notaInputs[e.id];
        if (!raw || !raw.trim()) return null;
        const n = Math.max(0, Math.min(e.notaMax, Number(raw.replace(",", "."))));
        return Number.isNaN(n) ? null : { id: e.id, n };
      })
      .filter((x): x is { id: string; n: number } => x !== null);

    if (!cambios.length) {
      setCargarNotaAbierto(false);
      return;
    }

    if (usandoDemoEvals) {
      setDemoEvaluaciones((prev) =>
        prev.map((e) => {
          const cambio = cambios.find((c) => c.id === e.id);
          return cambio ? { ...e, estado: "aprobada", nota: cambio.n } : e;
        })
      );
      setCargarNotaAbierto(false);
      return;
    }

    const resultados = await Promise.all(cambios.map((c) => agenda.asignarNota(c.id, c.n)));
    setCargarNotaAbierto(false);
    if (resultados.some((ok) => !ok)) avisarError("No se pudieron guardar algunas notas");
  };

  const abrirCrearItem = (tipo: "evaluacion" | "tarea") => {
    setCrearItemTitulo("");
    setCrearItemTipo(tipo);
  };

  const confirmarCrearItem = async () => {
    if (!crearItemTipo || !crearItemTitulo.trim()) return;
    const tipo = crearItemTipo === "evaluacion" ? "Parcial" : "Entrega";

    if (usandoDemoEvals) {
      const nuevo: DemoEvaluacion = { id: `local-${Date.now()}`, nombre: crearItemTitulo.trim(), estado: "pendiente", notaMax: materia.escalaTotal };
      setDemoEvaluaciones((prev) => [...prev, nuevo]);
      setCrearItemTipo(null);
      return;
    }

    const ok = await agenda.crear({
      materiaId: materia.id,
      kind: crearItemTipo,
      tipo,
      titulo: crearItemTitulo.trim(),
      fecha: isoToday(),
      notaMaxima: crearItemTipo === "evaluacion" ? materia.escalaTotal : null,
    });
    if (!ok) {
      avisarError("No se pudo crear");
      return;
    }
    setCrearItemTipo(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, gap: spacing.lg }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <BackButton />
          <View
            style={{ width: 40, height: 40, borderRadius: radii.sm, backgroundColor: accent.strong, alignItems: "center", justifyContent: "center" }}
          >
            <AppText weight="600" style={{ fontSize: 12, color: colors.white }}>
              {materiaAbrev(materia.nombre)}
            </AppText>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <AppText weight="600" numberOfLines={1} style={{ fontSize: 18, letterSpacing: -0.2, flexShrink: 1 }}>
                {materia.nombre}
              </AppText>
              <Pill label={estadoLabel[materia.estado]} background={tone[estadoTone[materia.estado]].soft} color={tone[estadoTone[materia.estado]].text} />
            </View>
            <AppText mono style={{ fontSize: 12, color: colors.textTertiary }}>
              {materia.docente} · {escalaLabel(materia.escalaTotal).toLowerCase()}
            </AppText>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: spacing.xxxl }}>
          <View style={{ gap: 1 }}>
            <AppText style={{ fontSize: 11, color: colors.textFaint }}>Salón</AppText>
            <AppText mono weight="600" style={{ fontSize: 13 }}>
              {materia.salon || "Sin salón asignado"}
            </AppText>
          </View>
          <View style={{ gap: 1 }}>
            <AppText style={{ fontSize: 11, color: colors.textFaint }}>Cursada</AppText>
            <AppText mono weight="600" style={{ fontSize: 13 }}>
              {materia.periodoLabel}
            </AppText>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          <PressableScale scaleTo={0.97} onPress={() => stub("Editar materia")}>
            <Pill label="Editar materia" background={colors.surfaceSoft} style={{ height: 34, paddingHorizontal: 14 }} />
          </PressableScale>
          <PressableScale scaleTo={0.97} onPress={() => abrirCrearItem("tarea")}>
            <Pill label="+ Nueva tarea" background={colors.surfaceSoft} style={{ height: 34, paddingHorizontal: 14 }} />
          </PressableScale>
          <PressableScale scaleTo={0.97} onPress={() => abrirCrearItem("evaluacion")}>
            <Pill label="+ Nueva evaluación" background={colors.accent} color={colors.white} style={{ height: 34, paddingHorizontal: 14 }} />
          </PressableScale>
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, gap: spacing.xl, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Calificación y aprobación */}
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText weight="600" style={{ fontSize: 17, letterSpacing: -0.2 }}>
              Calificación y aprobación
            </AppText>
            <Pill label={escalaLabel(materia.escalaTotal)} background={colors.surfaceSoft} />
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
            <ProgressRing
              size={104}
              strokeWidth={11}
              progress={pct}
              color={t.strong}
              centerValue={notaTxt}
              centerLabel={`aprueba ${formatValor(materia.escalaAprob, materia.escalaTotal)}${unidad(materia.escalaTotal)}`}
              valueFontSize={26}
              labelFontSize={11}
            />
            <View style={{ flex: 1, gap: spacing.sm }}>
              {notasList.length ? (
                notasList.map((e) => (
                  <View key={e.id} style={{ gap: 3 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <AppText numberOfLines={1} style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}>
                        {e.nombre}
                      </AppText>
                      <AppText mono weight="600" style={{ fontSize: 13 }}>
                        {formatValor(e.nota ?? 0, materia.escalaTotal)}
                        {unidad(materia.escalaTotal)}
                      </AppText>
                    </View>
                    <View style={{ height: 4, borderRadius: radii.round, backgroundColor: colors.surfaceSoft, overflow: "hidden" }}>
                      <View style={{ width: `${((e.nota ?? 0) / e.notaMax) * 100}%`, height: "100%", borderRadius: radii.round, backgroundColor: t.strong }} />
                    </View>
                  </View>
                ))
              ) : (
                <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Todavía no cargaste notas.</AppText>
              )}
            </View>
          </View>

          <View style={{ padding: spacing.lg, borderRadius: radii.md, backgroundColor: t.soft, borderWidth: 1, borderColor: t.strong + "33", gap: 4 }}>
            <AppText weight="600" style={{ fontSize: 14 }}>
              {callout.titulo}
            </AppText>
            <AppText style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>{callout.texto}</AppText>
          </View>

          <View style={{ flexDirection: "row", gap: spacing.smd }}>
            <PrimaryButton label="Cargar nota" flex onPress={abrirCargarNota} />
            <PrimaryButton label="Cambiar escala" variant="ghost" flex onPress={() => stub("Cambiar escala y aprobación")} />
          </View>

          {materia.componentesFijos.length ? (
            <View style={{ gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderFaint }}>
              <AppText weight="600" style={{ fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: colors.textFaint }}>
                Puntos fijos del curso
              </AppText>
              <AppText style={{ fontSize: 12, color: colors.textTertiary, lineHeight: 16 }}>
                No tienen fecha ni son una tarea — cargalos vos cuando el profesor te los dé.
              </AppText>
              {materia.componentesFijos.map((c) => (
                <View key={c.id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <AppText style={{ fontSize: 13, color: colors.textSecondary }}>{c.titulo}</AppText>
                  <AppText mono weight="600" style={{ fontSize: 13 }}>
                    {c.valor != null ? `${c.valor}/${c.puntajeMax}` : `— /${c.puntajeMax}`}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}

          {haySimulable ? (
            <PressableScale scaleTo={0.98} onPress={() => setSimuladorAbierto((v) => !v)}>
              <View
                style={{
                  height: 40,
                  borderRadius: radii.sm,
                  backgroundColor: colors.surfaceSoft,
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: spacing.sm,
                }}
              >
                <Ionicons name={simuladorAbierto ? "chevron-up" : "options-outline"} size={15} color={colors.text} />
                <AppText weight="600" style={{ fontSize: 13 }}>
                  Simular escenario
                </AppText>
              </View>
            </PressableScale>
          ) : null}

          {haySimulable && simuladorAbierto ? (
            <View style={{ gap: spacing.lg, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.borderFaint }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
                <ProgressRing size={64} strokeWidth={7} progress={simPct} color={tone[simTone].strong} centerValue={formatValor(sim.puntosProyectados, materia.escalaTotal)} valueFontSize={14} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Pill label="Simulado" background={colors.accentSofter} color={colors.accentText} style={{ height: 20, paddingHorizontal: 8 }} />
                  <AppText style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
                    {sim.asegurado
                      ? "Ya asegurada la aprobación con lo que ya tenés, pase lo que pase en el resto."
                      : sim.imposible
                        ? "Con lo que ya tenés y lo máximo que falta, ya no es matemáticamente posible aprobar."
                        : sim.faltanAprobacion === 0
                          ? `Con este escenario, llegás a ${formatValor(sim.puntosProyectados, materia.escalaTotal)}${unidad(materia.escalaTotal)} — aprobarías.`
                          : `Con este escenario, te faltan ${formatValor(sim.faltanAprobacion ?? 0, materia.escalaTotal)}${unidad(materia.escalaTotal)} para aprobar (${formatValor(sim.aprob, materia.escalaTotal)}${unidad(materia.escalaTotal)}).`}
                  </AppText>
                </View>
              </View>

              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ gap: 2 }}>
                  <AppText style={{ fontSize: 11, color: colors.textFaint }}>Puntos reales</AppText>
                  <AppText mono weight="600" style={{ fontSize: 14 }}>
                    {formatValor(sim.puntosReales, materia.escalaTotal)}
                    {unidad(materia.escalaTotal)}
                  </AppText>
                </View>
                <View style={{ gap: 2 }}>
                  <AppText style={{ fontSize: 11, color: colors.textFaint }}>Disponibles</AppText>
                  <AppText mono weight="600" style={{ fontSize: 14 }}>
                    {formatValor(sim.disponibles, materia.escalaTotal)}
                    {unidad(materia.escalaTotal)}
                  </AppText>
                </View>
                <View style={{ gap: 2 }}>
                  <AppText style={{ fontSize: 11, color: colors.textFaint }}>Proyectado</AppText>
                  <AppText mono weight="600" style={{ fontSize: 14 }}>
                    {formatValor(sim.puntosProyectados, materia.escalaTotal)}/{formatValor(sim.total, materia.escalaTotal)}
                  </AppText>
                </View>
              </View>

              {sim.asegurado ? (
                <Aviso tone="success" texto="Aprobación asegurada con lo que ya tenés." />
              ) : sim.imposible ? (
                <Aviso tone="danger" texto={`Objetivo imposible: incluso sacando el máximo en todo lo que falta, no se llega a ${formatValor(sim.aprob, materia.escalaTotal)}${unidad(materia.escalaTotal)}.`} />
              ) : sim.promedioNecesario != null ? (
                <Aviso tone="warning" texto={`Necesitás promediar ${formatValor(sim.promedioNecesario, materia.escalaTotal)}${unidad(materia.escalaTotal)} en las evaluaciones que faltan para llegar al mínimo.`} />
              ) : null}

              {sim.exoneracion != null ? (
                sim.exonerado ? (
                  <Aviso tone="success" texto={`Exoneración asegurada con lo que ya tenés (${formatValor(sim.exoneracion, materia.escalaTotal)}${unidad(materia.escalaTotal)}).`} />
                ) : sim.imposibleExonerar ? (
                  <Aviso tone="danger" texto={`Exonerar ya no es matemáticamente posible: no se llega a ${formatValor(sim.exoneracion, materia.escalaTotal)}${unidad(materia.escalaTotal)}.`} />
                ) : (
                  <Aviso tone="warning" texto={`Con este escenario, te faltan ${formatValor(sim.faltanExoneracion ?? 0, materia.escalaTotal)}${unidad(materia.escalaTotal)} para exonerar (${formatValor(sim.exoneracion, materia.escalaTotal)}${unidad(materia.escalaTotal)}).`} />
                )
              ) : null}

              <View style={{ gap: spacing.lg }}>
                {evaluacionesSinNota.map((e) => (
                  <View key={e.id} style={{ gap: spacing.sm - 2 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <AppText style={{ fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>
                        {e.nombre}
                      </AppText>
                      <AppText mono weight="600" style={{ fontSize: 13 }}>
                        {formatValor(valoresSimulados[e.id] ?? 0, materia.escalaTotal)}/{formatValor(e.notaMax, materia.escalaTotal)}
                      </AppText>
                    </View>
                    <RangeSlider max={e.notaMax} value={valoresSimulados[e.id] ?? 0} color={t.strong} onChange={(v) => setValoresSimulados((prev) => ({ ...prev, [e.id]: v }))} />
                  </View>
                ))}
                {fijosSinValor.map((c) => (
                  <View key={c.id} style={{ gap: spacing.sm - 2 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <AppText style={{ fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>
                        {c.titulo}
                      </AppText>
                      <AppText mono weight="600" style={{ fontSize: 13 }}>
                        {formatValor(valoresSimulados[c.id] ?? 0, materia.escalaTotal)}/{formatValor(c.puntajeMax, materia.escalaTotal)}
                      </AppText>
                    </View>
                    <RangeSlider max={c.puntajeMax} value={valoresSimulados[c.id] ?? 0} color={t.strong} onChange={(v) => setValoresSimulados((prev) => ({ ...prev, [c.id]: v }))} />
                  </View>
                ))}
              </View>

              {sim.escalaInconsistente ? (
                <AppText style={{ fontSize: 11, color: colors.textFaint, lineHeight: 15 }}>
                  Ojo: la suma de notas máximas de las evaluaciones no coincide con el total de la materia ({formatValor(materia.escalaTotal, materia.escalaTotal)}
                  {unidad(materia.escalaTotal)}).
                </AppText>
              ) : null}

              <PressableScale scaleTo={0.97} onPress={() => setValoresSimulados({})}>
                <AppText weight="600" style={{ fontSize: 13, color: colors.accentText, textAlign: "center" }}>
                  Reiniciar simulación
                </AppText>
              </PressableScale>
            </View>
          ) : null}
        </Card>

        {/* Evaluaciones y tareas */}
        <Card>
          <SectionTitle hint={`${evaluaciones.length} ${evaluaciones.length === 1 ? "ítem" : "ítems"}`}>Evaluaciones y tareas</SectionTitle>
          {pendientesEvals.length === 0 && completadasEvals.length === 0 ? (
            <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Todavía no hay evaluaciones ni tareas para esta materia.</AppText>
          ) : (
            <View style={{ gap: spacing.sm }}>
              {pendientesEvals.map((e) => (
                <EvalRow key={e.id} item={e} materia={materia} onPress={() => setAccionItem(e)} />
              ))}
              {completadasEvals.map((e) => (
                <EvalRow key={e.id} item={e} materia={materia} onPress={() => setAccionItem(e)} />
              ))}
            </View>
          )}
        </Card>

        {/* Mini horario semanal */}
        <Card>
          <SectionTitle>Mini horario de la materia</SectionTitle>
          <View style={{ flexDirection: "row", gap: spacing.sm - 2 }}>
            {DIAS_BLOQUE.map((label, i) => {
              const b = bloquesPorDia.get(i + 1);
              return (
                <View key={label} style={{ flex: 1, gap: 4, alignItems: "center" }}>
                  <AppText style={{ fontSize: 11, color: colors.textFaint }}>{label}</AppText>
                  <View
                    style={{
                      width: "100%",
                      height: 54,
                      borderRadius: radii.sm - 2,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: b ? accent.soft : colors.surfaceSofter,
                    }}
                  >
                    {b ? (
                      <AppText mono weight="600" style={{ fontSize: 10, color: accent.strong, textAlign: "center" }}>
                        {horaTexto(b.ini)}
                        {"\n"}
                        {horaTexto(b.fin)}
                      </AppText>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Asistencia */}
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <AppText weight="600" style={{ fontSize: 17, letterSpacing: -0.2 }}>
              Asistencia
            </AppText>
            <View style={{ flexDirection: "row", backgroundColor: colors.surfaceSofter, borderRadius: radii.sm, padding: 3, gap: 2 }}>
              {(["semana", "mes", "semestre"] as RangoAsistencia[]).map((r) => (
                <PressableScale
                  key={r}
                  scaleTo={0.97}
                  onPress={() => setRangoAsistencia(r)}
                  style={{
                    height: 28,
                    paddingHorizontal: 10,
                    borderRadius: 8,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: rangoAsistencia === r ? colors.text : "transparent",
                  }}
                >
                  <AppText weight={rangoAsistencia === r ? "600" : "500"} style={{ fontSize: 12, color: rangoAsistencia === r ? colors.bg : colors.textSecondary, textTransform: "capitalize" }}>
                    {r}
                  </AppText>
                </PressableScale>
              ))}
            </View>
          </View>
          {asistenciaActual ? (
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: spacing.sm }}>
              <AppText mono weight="700" style={{ fontSize: 22 }}>
                {asistenciaActual.pct}%
              </AppText>
              <AppText style={{ fontSize: 13, color: colors.textSecondary }}>
                {asistenciaActual.presentes}/{asistenciaActual.total} clases
              </AppText>
            </View>
          ) : (
            <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Sin registros de asistencia en este rango.</AppText>
          )}
        </Card>
      </ScrollView>

      {/* Cargar nota */}
      <BottomSheet visible={cargarNotaAbierto} onClose={() => setCargarNotaAbierto(false)}>
        <AppText weight="600" style={{ fontSize: 19, letterSpacing: -0.1 }}>
          Cargar nota
        </AppText>
        <View style={{ gap: spacing.md }}>
          {pendientesEvals.map((e) => (
            <View key={e.id} style={{ gap: 6 }}>
              <AppText style={{ fontSize: 13, color: colors.textSecondary }} numberOfLines={1}>
                {e.nombre}
              </AppText>
              <TextInput
                value={notaInputs[e.id] ?? ""}
                onChangeText={(v) => setNotaInputs((prev) => ({ ...prev, [e.id]: v }))}
                placeholder={`Nota sobre ${e.notaMax}`}
                placeholderTextColor={colors.textFaint}
                keyboardType="decimal-pad"
                style={{
                  height: 46,
                  borderRadius: radii.sm,
                  backgroundColor: colors.bg,
                  paddingHorizontal: spacing.lg,
                  fontSize: 15,
                  color: colors.text,
                  fontFamily: "InstrumentSans_600SemiBold",
                }}
              />
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: spacing.smd, paddingTop: spacing.xs }}>
          <PrimaryButton label="Cancelar" variant="ghost" flex onPress={() => setCargarNotaAbierto(false)} />
          <PrimaryButton label="Guardar" flex onPress={guardarNotas} />
        </View>
      </BottomSheet>

      {/* Nueva evaluación / tarea */}
      <BottomSheet visible={!!crearItemTipo} onClose={() => setCrearItemTipo(null)}>
        <AppText weight="600" style={{ fontSize: 19, letterSpacing: -0.1 }}>
          {crearItemTipo === "evaluacion" ? "Nueva evaluación" : "Nueva tarea"}
        </AppText>
        <TextInput
          value={crearItemTitulo}
          onChangeText={setCrearItemTitulo}
          placeholder="Título"
          placeholderTextColor={colors.textFaint}
          style={{
            height: 48,
            borderRadius: radii.sm,
            backgroundColor: colors.bg,
            paddingHorizontal: spacing.lg,
            fontSize: 15,
            color: colors.text,
            fontFamily: "InstrumentSans_400Regular",
          }}
        />
        <AppText style={{ fontSize: 12, color: colors.textFaint }}>Se agenda para hoy — la fecha se podrá elegir en la próxima iteración.</AppText>
        <View style={{ flexDirection: "row", gap: spacing.smd, paddingTop: spacing.xs }}>
          <PrimaryButton label="Cancelar" variant="ghost" flex onPress={() => setCrearItemTipo(null)} />
          <PrimaryButton label="Crear" flex disabled={!crearItemTitulo.trim()} onPress={confirmarCrearItem} />
        </View>
      </BottomSheet>

      {/* Acciones de fila */}
      <BottomSheet visible={!!accionItem} onClose={() => setAccionItem(null)}>
        <AppText weight="600" style={{ fontSize: 17 }} numberOfLines={1}>
          {accionItem?.nombre}
        </AppText>
        {accionItem && accionItem.estado === "pendiente" ? (
          <PressableScale
            scaleTo={0.99}
            onPress={() => {
              setNotaInputs({});
              setCargarNotaAbierto(true);
              setAccionItem(null);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color={colors.text} />
            <AppText weight="500" style={{ fontSize: 15 }}>
              Marcar como rendida / cargar nota
            </AppText>
          </PressableScale>
        ) : null}
        {accionItem && accionItem.estado === "aprobada" ? (
          <PressableScale
            scaleTo={0.99}
            onPress={() => {
              if (accionItem) {
                if (usandoDemoEvals) {
                  setDemoEvaluaciones((prev) => prev.map((e) => (e.id === accionItem.id ? { ...e, estado: "pendiente", nota: undefined } : e)));
                } else {
                  agenda.marcarHecho(accionItem.id, false).then((ok) => {
                    if (!ok) avisarError("No se pudo actualizar");
                  });
                }
              }
              setAccionItem(null);
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md }}
          >
            <Ionicons name="arrow-undo-outline" size={18} color={colors.text} />
            <AppText weight="500" style={{ fontSize: 15 }}>
              Marcar como pendiente
            </AppText>
          </PressableScale>
        ) : null}
        <PressableScale
          scaleTo={0.99}
          onPress={() => {
            setAccionItem(null);
            stub("Editar");
          }}
          style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderFaint }}
        >
          <Ionicons name="create-outline" size={18} color={colors.text} />
          <AppText weight="500" style={{ fontSize: 15 }}>
            Editar
          </AppText>
        </PressableScale>
      </BottomSheet>
    </SafeAreaView>
  );
}

function Aviso({ tone: t, texto }: { tone: Tone; texto: string }) {
  const c = tone[t];
  return (
    <View style={{ padding: spacing.md, borderRadius: radii.sm, backgroundColor: c.soft, borderWidth: 1, borderColor: c.strong + "33" }}>
      <AppText style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 17 }}>{texto}</AppText>
    </View>
  );
}

function EvalRow({ item, materia, onPress }: { item: DemoEvaluacion; materia: DemoMateria; onPress: () => void }) {
  const hecho = item.estado === "aprobada";
  return (
    <PressableScale
      scaleTo={0.99}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderTopWidth: 1,
        borderTopColor: colors.borderFaint,
      }}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 11,
          borderWidth: hecho ? 0 : 2,
          borderColor: colors.accent,
          backgroundColor: hecho ? colors.success : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {hecho ? <Ionicons name="checkmark" size={13} color={colors.bg} /> : null}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <AppText weight="500" numberOfLines={1} style={{ fontSize: 15, color: hecho ? colors.textTertiary : colors.text, textDecorationLine: hecho ? "line-through" : "none" }}>
          {item.nombre}
        </AppText>
        {!hecho && item.fechaLabel ? <AppText style={{ fontSize: 12, color: colors.accentText }}>{item.fechaLabel}</AppText> : null}
      </View>
      {hecho ? (
        <AppText mono weight="600" style={{ fontSize: 15 }}>
          {formatValor(item.nota ?? 0, materia.escalaTotal)}
          <AppText style={{ fontSize: 12, color: colors.textTertiary }}>/{formatValor(item.notaMax, materia.escalaTotal)}</AppText>
        </AppText>
      ) : (
        <Pill label="Cargar nota" color={colors.accentText} background={colors.accentSoft} />
      )}
    </PressableScale>
  );
}
