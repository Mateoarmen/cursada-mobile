import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, ScrollView, TextInput, View, type TextInputProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { Materia } from "@/types/database";
import { materiaColors, radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, BackButton, BottomSheet, MiniCalendario, Pill, PressableScale, PrimaryButton, Reveal, Spotlight } from "@/components/ui";
import { materiaComputadaToRow } from "@/lib/materias";
import { getSemestreActivoId } from "@/lib/semestres";
import { useAgenda } from "@/hooks/useAgenda";
import { usePersonal } from "@/hooks/usePersonal";
import { agendaBadgeInfo, diffDias, formatFechaAgenda, parseISODate, today } from "@/lib/agenda";

type IconName = Parameters<typeof AppIcon>[0]["name"];

// Acción secundaria: media fila, ícono + rótulo. Reemplaza a la lista
// vertical de filas-menú, que ponía al mismo nivel "Marcar como rendida"
// y "Eliminar".
function AccionTile({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      scaleTo={0.97}
      onPress={onPress}
      style={{
        flexBasis: "48%",
        flexGrow: 1,
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        borderRadius: radii.sm,
        backgroundColor: colors.surface,
      }}
    >
      <AppIcon name={icon} size={18} color={colors.textSecondary} />
      <AppText weight="500" numberOfLines={1} style={{ fontSize: 15, flexShrink: 1 }}>
        {label}
      </AppText>
    </PressableScale>
  );
}

function Field({ label, flex, children }: { label: string; flex?: boolean; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[{ gap: spacing.sm }, flex ? { flex: 1 } : null]}>
      <AppText style={{ fontSize: 12, color: colors.textTertiary }}>{label}</AppText>
      {children}
    </View>
  );
}

function FieldInput({ semibold, ...props }: TextInputProps & { semibold?: boolean }) {
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      {...props}
      style={{
        height: 48,
        borderRadius: radii.sm,
        backgroundColor: colors.bg,
        paddingHorizontal: spacing.lg,
        fontSize: 16,
        color: colors.text,
        fontFamily: semibold ? "InstrumentSans_600SemiBold" : "InstrumentSans_400Regular",
      }}
    />
  );
}

// Pantalla de detalle de un ítem de Agenda (evaluación/tarea/personal) —
// antes tocar una fila sólo abría el BottomSheet de acciones (marcar
// hecho/rendida, cargar nota, ir a materia, eliminar) sin mostrar nunca el
// detalle completo (ver critique: falta pantalla de detalle). El
// BottomSheet de acciones de app/(tabs)/agenda.tsx se movió acá entero,
// no se duplica.
//
// Sin endpoint "por id" para agenda/personal (ver useAgenda.ts/
// usePersonal.ts): se resuelve el ítem buscándolo en los arrays que esos
// hooks ya fetchean completos, filtrando por `id` + `kind` (recibidos por
// query param, ver onPressItem en agenda.tsx).
export default function ItemDetalleScreen() {
  const { colors, tone } = useTheme();
  const { id, kind, desde } = useLocalSearchParams<{ id: string; kind?: string; desde?: string }>();
  const esPersonal = kind === "personal";

  const agenda = useAgenda();
  const personal = usePersonal();
  const [supaMaterias, setSupaMaterias] = useState<Materia[] | null>(null);

  useEffect(() => {
    supabase
      .from("materias")
      .select("*")
      .then(({ data }) => setSupaMaterias(data ?? []));
  }, []);

  const materiaLookup = useMemo(
    () => new Map((supaMaterias ?? []).map((m) => [m.id, materiaComputadaToRow(m, agenda.rows ?? [])])),
    [supaMaterias, agenda.rows]
  );

  const item = esPersonal ? personal.items.find((p) => p.id === id) ?? null : agenda.items.find((a) => a.id === id) ?? null;
  const materia = item?.materiaId ? materiaLookup.get(item.materiaId) ?? null : null;
  const dataReady = esPersonal ? personal.rows !== null : agenda.rows !== null && supaMaterias !== null;

  const [activeSemestreId, setActiveSemestreId] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    getSemestreActivoId()
      .then(setActiveSemestreId)
      .catch(() => setActiveSemestreId(null));
  }, []);

  // Selector de materia acotado al semestre activo (mismo criterio que
  // task 12 en Agenda) — más la materia actual del ítem aunque sea de un
  // semestre viejo, para no perderla de las opciones si se abre Editar
  // sobre algo histórico.
  const materiaOpts = useMemo(
    () =>
      (supaMaterias ?? [])
        .filter((m) => m.semestre_id === activeSemestreId || m.id === item?.materiaId)
        .map((m) => ({ value: m.id, label: m.nombre })),
    [supaMaterias, activeSemestreId, item?.materiaId]
  );

  const [editando, setEditando] = useState(false);
  const [editCalendarioAbierto, setEditCalendarioAbierto] = useState(false);
  const [editTitulo, setEditTitulo] = useState("");
  const [editTipo, setEditTipo] = useState("");
  const [editFecha, setEditFecha] = useState("");
  const [editMateriaId, setEditMateriaId] = useState("");
  const [editNotaMax, setEditNotaMax] = useState("");
  const [editNota, setEditNota] = useState("");
  const [notaSheetAbierto, setNotaSheetAbierto] = useState(false);
  const [notaValor, setNotaValor] = useState("");

  const t = useMemo(() => today(), []);

  const avisarError = (titulo: string) => Alert.alert(titulo, "Revisá tu conexión e intentá de nuevo.");

  const marcarRendida = async () => {
    if (!item) return;
    const ok = await agenda.marcarHecho(item.id, true);
    if (!ok) avisarError("No se pudo actualizar");
  };

  // Ambiguo si la evaluación ya tiene nota cargada: volver a "pendiente" no
  // debería borrar esa nota en silencio, así que se pregunta explícitamente
  // (ver mismo criterio en el circulito de Agenda, app/(tabs)/agenda.tsx).
  const marcarPendiente = async () => {
    if (!item) return;
    if (item.nota != null) {
      Alert.alert("Marcar como pendiente", "Esta evaluación tiene una nota cargada. ¿Qué querés hacer?", [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Mantener la nota",
          onPress: async () => {
            const ok = await agenda.marcarHecho(item.id, false);
            if (!ok) avisarError("No se pudo actualizar");
          },
        },
        {
          text: "Quitar nota también",
          style: "destructive",
          onPress: async () => {
            const okNota = await agenda.borrarNota(item.id);
            const ok = await agenda.marcarHecho(item.id, false);
            if (!okNota || !ok) avisarError("No se pudo actualizar");
          },
        },
      ]);
      return;
    }
    const ok = await agenda.marcarHecho(item.id, false);
    if (!ok) avisarError("No se pudo actualizar");
  };

  const abrirNota = () => {
    if (!item) return;
    setNotaValor(item.nota != null ? String(item.nota) : "");
    setNotaSheetAbierto(true);
  };

  const guardarNota = async () => {
    if (!item) return;
    const raw = notaValor.trim();
    if (!raw) return;
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return;
    const ok = await agenda.asignarNota(item.id, n);
    if (!ok) {
      avisarError("No se pudo guardar la nota");
      return;
    }
    setNotaSheetAbierto(false);
  };

  const quitarNota = () => {
    if (!item) return;
    Alert.alert("Quitar nota", "¿Quitar la nota cargada? La evaluación queda marcada como rendida, esperando nota.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Quitar nota",
        style: "destructive",
        onPress: async () => {
          const ok = await agenda.borrarNota(item.id);
          if (!ok) avisarError("No se pudo quitar la nota");
        },
      },
    ]);
  };

  const abrirEditar = () => {
    if (!item) return;
    setEditTitulo(item.titulo);
    setEditTipo(item.tipo);
    setEditFecha(item.fecha);
    setEditMateriaId(item.materiaId ?? "");
    setEditNotaMax(item.notaMaxima != null ? String(item.notaMaxima) : "");
    setEditNota(item.nota != null ? String(item.nota) : "");
    setEditCalendarioAbierto(false);
    setEditando(true);
  };

  const confirmarEditar = async () => {
    if (!item) return;
    const ok = await agenda.actualizar(item.id, {
      titulo: editTitulo.trim(),
      tipo: editTipo.trim(),
      fecha: editFecha,
      materia_id: editMateriaId || null,
      nota_maxima: editNotaMax.trim() ? Number(editNotaMax.replace(",", ".")) : null,
    });
    if (!ok) {
      avisarError("No se pudo guardar los cambios");
      return;
    }
    const notaRaw = editNota.trim();
    if (notaRaw) {
      const n = Number(notaRaw.replace(",", "."));
      if (Number.isFinite(n)) await agenda.asignarNota(item.id, n);
    }
    setEditando(false);
  };

  const eliminar = () => {
    if (!item) return;
    Alert.alert("Eliminar", `¿Eliminar "${item.titulo}" de la agenda?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          const ok = esPersonal ? await personal.eliminar(item.id) : await agenda.eliminar(item.id);
          if (!ok) {
            avisarError("No se pudo eliminar");
            return;
          }
          router.back();
        },
      },
    ]);
  };

  if (!dataReady || !item) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
        <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <BackButton />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          {!dataReady ? (
            <ActivityIndicator color={colors.textTertiary} />
          ) : (
            <AppText style={{ fontSize: 14, color: colors.textTertiary }}>No se encontró el ítem.</AppText>
          )}
        </View>
      </SafeAreaView>
    );
  }

  const accent = materia ? materiaColors[materia.colorId] : { strong: colors.neutral, soft: colors.neutralSoft };
  const badge = !esPersonal
    ? agendaBadgeInfo({ hecho: item.hecho, itemKind: item.itemKind!, nota: item.nota, fecha: item.fecha }, t)
    : { tone: "neutral" as const, label: item.todoElDia ? "Todo el día" : "Personal" };
  const badgeTone = tone[badge.tone];

  const esEval = !esPersonal && item.itemKind === "evaluacion";
  const tieneNota = item.nota != null;
  const tituloPantalla = esPersonal ? "Evento" : esEval ? "Evaluación" : "Tarea";

  // Distancia en días sólo mientras el ítem sigue pendiente — una vez
  // rendido/entregado ya no informa nada y el badge de estado alcanza.
  const dias = diffDias(parseISODate(item.fecha), t);
  const relativo = item.hecho
    ? null
    : dias === 0
      ? "Hoy"
      : dias === 1
        ? "Mañana"
        : dias > 1
          ? `En ${dias} días`
          : `Hace ${Math.abs(dias)} ${Math.abs(dias) === 1 ? "día" : "días"}`;

  const accionPrincipal = esPersonal
    ? null
    : !item.hecho
      ? { label: esEval ? "Marcar como rendida" : "Marcar como entregada", onPress: marcarRendida }
      : esEval && !tieneNota
        ? { label: "Asignar nota", onPress: abrirNota }
        : null;

  const acciones: { icon: IconName; label: string; onPress: () => void }[] = [];
  if (!esPersonal) {
    if (item.hecho) acciones.push({ icon: "arrow-undo-outline", label: "Marcar pendiente", onPress: marcarPendiente });
    if (esEval && (tieneNota || !item.hecho)) {
      acciones.push({ icon: tieneNota ? "create-outline" : "add-circle-outline", label: tieneNota ? "Editar nota" : "Asignar nota", onPress: abrirNota });
    }
    acciones.push({ icon: "create-outline", label: "Editar", onPress: abrirEditar });
  }
  if (materia && desde !== "materia") acciones.push({ icon: "folder-outline", label: "Ver materia", onPress: () => router.push(`/materia/${materia.id}`) });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <Spotlight height={280} />
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <BackButton />
        <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2 }}>
          {tituloPantalla}
        </AppText>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xxxl * 2, gap: spacing.xxl }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Reveal style={{ gap: spacing.xxl }}>
          {/* Identidad: qué es y en qué estado está */}
          <View style={{ gap: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, flexWrap: "wrap" }}>
              {materia ? <Pill label={materia.nombre} background={accent.soft} color={accent.strong} /> : null}
              {item.tipo ? (
                <AppText weight="500" style={{ fontSize: 13, color: colors.textTertiary }}>
                  {item.tipo}
                </AppText>
              ) : null}
            </View>
            <AppText weight="700" style={{ fontSize: 30, lineHeight: 34, letterSpacing: -0.7 }}>
              {item.titulo}
            </AppText>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.smd }}>
              <Pill label={badge.label} color={badgeTone.text} background={badgeTone.soft} />
              {relativo ? (
                <AppText weight="500" style={{ fontSize: 13, color: colors.textSecondary }}>
                  {relativo}
                </AppText>
              ) : null}
            </View>
          </View>

          {/* Datos: fecha y nota lado a lado en una sola superficie */}
          <View style={{ flexDirection: "row", backgroundColor: colors.surface, borderRadius: radii.lg }}>
            <View style={{ flex: 1, padding: spacing.xl, gap: spacing.xs }}>
              <AppText style={{ fontSize: 12, color: colors.textTertiary }}>Fecha</AppText>
              <AppText mono style={{ fontSize: 17 }}>
                {formatFechaAgenda(item.fecha, item.todoElDia ? undefined : item.hora)}
              </AppText>
            </View>
            {esEval || item.notaMaxima != null ? (
              <>
                <View style={{ width: 1, backgroundColor: colors.borderFaint, marginVertical: spacing.lg }} />
                <View style={{ flex: 1, padding: spacing.xl, gap: spacing.xs }}>
                  <AppText style={{ fontSize: 12, color: colors.textTertiary }}>{esEval ? "Nota" : "Peso"}</AppText>
                  {esEval && tieneNota ? (
                    <AppText mono style={{ fontSize: 17 }}>
                      {item.nota}
                      <AppText mono style={{ fontSize: 17, color: colors.textTertiary }}> / {item.notaMaxima ?? 12}</AppText>
                    </AppText>
                  ) : (
                    <AppText mono style={{ fontSize: 17, color: colors.textTertiary }}>
                      {esEval ? `Sin cargar` : item.notaMaxima}
                    </AppText>
                  )}
                </View>
              </>
            ) : null}
          </View>

          {!esPersonal && editando ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.xl, gap: spacing.xl }}>
              <AppText weight="600" style={{ fontSize: 17, letterSpacing: -0.2 }}>
                Editar {esEval ? "evaluación" : "tarea"}
              </AppText>

              <Field label="Título">
                <FieldInput value={editTitulo} onChangeText={setEditTitulo} />
              </Field>

              <Field label="Tipo">
                <FieldInput value={editTipo} onChangeText={setEditTipo} placeholder="Ej. Parcial, Entrega, Quiz" />
              </Field>

              <Field label="Materia">
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                  {materiaOpts.map((o) => (
                    <PressableScale key={o.value} scaleTo={0.96} onPress={() => setEditMateriaId(o.value)}>
                      <Pill
                        label={o.label}
                        color={editMateriaId === o.value ? colors.accentText : colors.textSecondary}
                        background={editMateriaId === o.value ? colors.accentSoft : colors.surfaceSoft}
                      />
                    </PressableScale>
                  ))}
                </View>
              </Field>

              <Field label="Fecha">
                <PressableScale scaleTo={0.98} onPress={() => setEditCalendarioAbierto((v) => !v)}>
                  <Pill
                    label={formatFechaAgenda(editFecha)}
                    color={editCalendarioAbierto ? colors.accentText : colors.textSecondary}
                    background={editCalendarioAbierto ? colors.accentSoft : colors.surfaceSoft}
                  />
                </PressableScale>
                {editCalendarioAbierto ? (
                  <MiniCalendario
                    seleccionado={editFecha}
                    onSeleccionar={(iso) => {
                      setEditFecha(iso);
                      setEditCalendarioAbierto(false);
                    }}
                  />
                ) : null}
              </Field>

              <View style={{ flexDirection: "row", gap: spacing.smd }}>
                <Field label="Peso (nota máxima)" flex>
                  <FieldInput value={editNotaMax} onChangeText={setEditNotaMax} placeholder="Ej. 12" keyboardType="decimal-pad" semibold />
                </Field>
                {esEval ? (
                  <Field label="Nota" flex>
                    <FieldInput value={editNota} onChangeText={setEditNota} placeholder="Sin cargar" keyboardType="decimal-pad" semibold />
                  </Field>
                ) : null}
              </View>

              <View style={{ flexDirection: "row", gap: spacing.smd }}>
                <PrimaryButton label="Cancelar" variant="ghost" flex onPress={() => setEditando(false)} />
                <PrimaryButton label="Guardar" flex disabled={!editTitulo.trim()} onPress={confirmarEditar} />
              </View>
            </View>
          ) : (
            <View style={{ gap: spacing.lg }}>
              {accionPrincipal ? <PrimaryButton label={accionPrincipal.label} onPress={accionPrincipal.onPress} /> : null}

              {acciones.length > 0 ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.smd }}>
                  {acciones.map((a) => (
                    <AccionTile key={a.label} icon={a.icon} label={a.label} onPress={a.onPress} />
                  ))}
                </View>
              ) : null}

              {/* Destructivo: separado del resto, sin peso visual */}
              <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing.xl, paddingTop: spacing.lg }}>
                {esEval && tieneNota ? (
                  <PressableScale scaleTo={0.97} onPress={quitarNota} style={{ minHeight: 44, justifyContent: "center" }}>
                    <AppText weight="500" style={{ fontSize: 15, color: colors.dangerText }}>
                      Quitar nota
                    </AppText>
                  </PressableScale>
                ) : null}
                <PressableScale scaleTo={0.97} onPress={eliminar} style={{ minHeight: 44, justifyContent: "center" }}>
                  <AppText weight="500" style={{ fontSize: 15, color: colors.dangerText }}>
                    Eliminar
                  </AppText>
                </PressableScale>
              </View>
            </View>
          )}
        </Reveal>
      </ScrollView>


      <BottomSheet visible={notaSheetAbierto} onClose={() => setNotaSheetAbierto(false)}>
        <AppText weight="600" style={{ fontSize: 19, letterSpacing: -0.1 }}>
          {item.nota != null ? "Editar nota" : "Asignar nota"}
        </AppText>
        <FieldInput
          value={notaValor}
          onChangeText={setNotaValor}
          placeholder={`Nota sobre ${item.notaMaxima ?? 12}`}
          keyboardType="decimal-pad"
          autoFocus
          semibold
        />
        <View style={{ flexDirection: "row", gap: spacing.smd, paddingTop: spacing.xs }}>
          <PrimaryButton label="Cancelar" variant="ghost" flex onPress={() => setNotaSheetAbierto(false)} />
          <PrimaryButton label="Guardar" flex disabled={!notaValor.trim()} onPress={guardarNota} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
