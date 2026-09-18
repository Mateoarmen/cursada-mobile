import { useEffect, useMemo, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import { ActivityIndicator, Alert, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { Materia } from "@/types/database";
import { materiaColors, radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppIcon, AppText, BackButton, MiniCalendario, Pill, PressableScale, PrimaryButton, Reveal, Spotlight } from "@/components/ui";
import { materiaComputadaToRow } from "@/lib/materias";
import { getSemestreActivoId } from "@/lib/semestres";
import { useAgenda } from "@/hooks/useAgenda";
import { usePersonal } from "@/hooks/usePersonal";
import { agendaBadgeInfo, formatFechaAgenda, today } from "@/lib/agenda";

function Card({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.xl, gap: spacing.lg }}>{children}</View>;
}

function AccionRow({ icon, label, color, onPress, first }: { icon: Parameters<typeof AppIcon>[0]["name"]; label: string; color?: string; onPress: () => void; first?: boolean }) {
  const { colors } = useTheme();
  return (
    <PressableScale
      scaleTo={0.99}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.md,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: colors.borderFaint,
      }}
    >
      <AppIcon name={icon} size={18} color={color ?? colors.text} />
      <AppText weight="500" style={{ fontSize: 15, color: color ?? colors.text }}>
        {label}
      </AppText>
    </PressableScale>
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
  const { id, kind } = useLocalSearchParams<{ id: string; kind?: string }>();
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

  const t = useMemo(() => today(), []);

  const avisarError = (titulo: string) => Alert.alert(titulo, "Revisá tu conexión e intentá de nuevo.");

  const toggleHecho = async () => {
    if (!item) return;
    const ok = await agenda.marcarHecho(item.id, !item.hecho);
    if (!ok) avisarError("No se pudo actualizar");
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <Spotlight height={280} />
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <BackButton />
        <AppText weight="600" style={{ fontSize: 18, letterSpacing: -0.2 }}>
          Detalle
        </AppText>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.xxxl, gap: spacing.xl }} showsVerticalScrollIndicator={false}>
        <Reveal style={{ gap: spacing.xl }}>
          <Card>
            <View style={{ gap: spacing.xs }}>
              <AppText weight="700" style={{ fontSize: 22, letterSpacing: -0.4 }}>
                {item.titulo}
              </AppText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {materia ? (
                  <Pill label={materia.nombre} background={accent.soft} color={accent.strong} style={{ height: 22, paddingHorizontal: 9 }} />
                ) : null}
                <AppText style={{ fontSize: 13, color: colors.textTertiary }}>{item.tipo}</AppText>
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Fecha</AppText>
                <AppText mono weight="500" style={{ fontSize: 13 }}>
                  {formatFechaAgenda(item.fecha, item.todoElDia ? undefined : item.hora)}
                </AppText>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Estado</AppText>
                <Pill label={badge.label} color={badgeTone.text} background={badgeTone.soft} style={{ height: 22, paddingHorizontal: 9 }} />
              </View>
              {item.nota != null ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Nota</AppText>
                  <AppText mono weight="600" style={{ fontSize: 13 }}>
                    {item.nota}/{item.notaMaxima ?? 12}
                  </AppText>
                </View>
              ) : null}
            </View>
          </Card>

          {!esPersonal && editando ? (
            <Card>
              <AppText weight="600" style={{ fontSize: 15 }}>
                Editar {item.itemKind === "evaluacion" ? "evaluación" : "tarea"}
              </AppText>

              <View style={{ gap: 6 }}>
                <AppText style={{ fontSize: 12, color: colors.textTertiary }}>Título</AppText>
                <TextInput
                  value={editTitulo}
                  onChangeText={setEditTitulo}
                  placeholderTextColor={colors.textFaint}
                  style={{
                    height: 46,
                    borderRadius: radii.sm,
                    backgroundColor: colors.bg,
                    paddingHorizontal: spacing.lg,
                    fontSize: 15,
                    color: colors.text,
                    fontFamily: "InstrumentSans_400Regular",
                  }}
                />
              </View>

              <View style={{ gap: 6 }}>
                <AppText style={{ fontSize: 12, color: colors.textTertiary }}>Tipo</AppText>
                <TextInput
                  value={editTipo}
                  onChangeText={setEditTipo}
                  placeholder="Ej. Parcial, Entrega, Quiz"
                  placeholderTextColor={colors.textFaint}
                  style={{
                    height: 46,
                    borderRadius: radii.sm,
                    backgroundColor: colors.bg,
                    paddingHorizontal: spacing.lg,
                    fontSize: 15,
                    color: colors.text,
                    fontFamily: "InstrumentSans_400Regular",
                  }}
                />
              </View>

              <View style={{ gap: 6 }}>
                <AppText style={{ fontSize: 12, color: colors.textTertiary }}>Materia</AppText>
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
              </View>

              <View style={{ gap: 6 }}>
                <AppText style={{ fontSize: 12, color: colors.textTertiary }}>Fecha</AppText>
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
              </View>

              <View style={{ flexDirection: "row", gap: spacing.smd }}>
                <View style={{ flex: 1, gap: 6 }}>
                  <AppText style={{ fontSize: 12, color: colors.textTertiary }}>Peso (nota máxima)</AppText>
                  <TextInput
                    value={editNotaMax}
                    onChangeText={setEditNotaMax}
                    placeholder="Ej. 12"
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
                {item.itemKind === "evaluacion" ? (
                  <View style={{ flex: 1, gap: 6 }}>
                    <AppText style={{ fontSize: 12, color: colors.textTertiary }}>Nota</AppText>
                    <TextInput
                      value={editNota}
                      onChangeText={setEditNota}
                      placeholder="Sin cargar"
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
                ) : null}
              </View>

              <View style={{ flexDirection: "row", gap: spacing.smd }}>
                <PrimaryButton label="Cancelar" variant="ghost" flex onPress={() => setEditando(false)} />
                <PrimaryButton label="Guardar" flex disabled={!editTitulo.trim()} onPress={confirmarEditar} />
              </View>
            </Card>
          ) : (
            <Card>
              {!esPersonal ? (
                <AccionRow
                  first
                  icon={item.hecho ? "arrow-undo-outline" : "checkmark-circle-outline"}
                  label={item.hecho ? "Marcar como pendiente" : item.itemKind === "evaluacion" ? "Marcar como rendida" : "Marcar como entregada"}
                  onPress={toggleHecho}
                />
              ) : null}
              {!esPersonal ? <AccionRow icon="create-outline" label="Editar" onPress={abrirEditar} /> : null}
              {materia ? (
                <AccionRow icon="folder-outline" label="Ver materia" onPress={() => router.push(`/materia/${materia.id}`)} first={esPersonal} />
              ) : null}
              <AccionRow icon="trash-outline" label="Eliminar" color={colors.dangerText} onPress={eliminar} first={esPersonal && !materia} />
            </Card>
          )}
        </Reveal>
      </ScrollView>
    </SafeAreaView>
  );
}
