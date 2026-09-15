import { useMemo, useState } from "react";
import { FlatList, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, radii, spacing } from "@/theme/tokens";
import { AppText, BottomSheet, Fab, Pill, PressableScale, PrimaryButton } from "@/components/ui";
import { demoAgenda, type DemoAgendaItem } from "@/data/demoContent";

const FILTERS = ["Todo", "Parciales", "Entregas"] as const;

const CARGA_SEMANA = [
  { pct: 41, color: colors.accentDeep },
  { pct: 25, color: colors.yellow },
  { pct: 17, color: colors.danger },
  { pct: 17, color: colors.cyan },
];

const GRUPO_LABEL: Record<DemoAgendaItem["grupo"], string> = {
  vencida: "Vencidas",
  "esta-semana": "Esta semana",
  proximas: "Próximas",
};

export default function AgendaScreen() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("Todo");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [titulo, setTitulo] = useState("");

  const grupos = useMemo(() => {
    const order: DemoAgendaItem["grupo"][] = ["vencida", "esta-semana", "proximas"];
    return order
      .map((grupo) => ({ grupo, items: demoAgenda.filter((e) => e.grupo === grupo) }))
      .filter((g) => g.items.length > 0);
  }, []);

  const vencidas = demoAgenda.filter((e) => e.grupo === "vencida").length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.md, paddingBottom: spacing.sm }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <AppText weight="700" style={{ fontSize: 29, letterSpacing: -0.6 }}>
            Agenda
          </AppText>
          <AppText style={{ fontSize: 12, color: colors.textTertiary }}>
            {demoAgenda.length} ítems · {vencidas} vencidos
          </AppText>
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, padding: spacing.md, gap: spacing.smd }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" }}>
            <AppText weight="600" style={{ fontSize: 14 }}>
              Carga de la semana
            </AppText>
            <AppText mono style={{ fontSize: 14, color: colors.textSecondary }}>
              12h
            </AppText>
          </View>
          <View style={{ height: 10, borderRadius: radii.round, overflow: "hidden", flexDirection: "row", gap: 2 }}>
            {CARGA_SEMANA.map((b, i) => (
              <View key={i} style={{ width: `${b.pct}%`, backgroundColor: b.color }} />
            ))}
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.xl, paddingBottom: spacing.sm }}>
        {FILTERS.map((f) => (
          <PressableScale key={f} scaleTo={0.96} onPress={() => setFilter(f)}>
            <Pill
              label={f}
              background={filter === f ? colors.text : colors.surfaceSoft}
              color={filter === f ? colors.bg : colors.textSecondary}
              style={{ height: 32, paddingHorizontal: 14 }}
            />
          </PressableScale>
        ))}
      </View>

      <FlatList
        data={grupos}
        keyExtractor={(g) => g.grupo}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 140, gap: spacing.sm }}
        renderItem={({ item: group }) => (
          <View style={{ gap: spacing.sm }}>
            <AppText
              weight="700"
              style={{
                fontSize: 11,
                letterSpacing: 0.7,
                textTransform: "uppercase",
                color: group.grupo === "vencida" ? colors.danger : colors.textSecondary,
                paddingTop: spacing.xs,
              }}
            >
              {GRUPO_LABEL[group.grupo]}
            </AppText>
            {group.items.map((ev) => (
              <View
                key={ev.id}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: radii.md,
                  padding: spacing.md + 2,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: spacing.md,
                  borderLeftWidth: 3,
                  borderLeftColor: ev.accentColor,
                  marginBottom: spacing.sm,
                }}
              >
                <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "rgba(245,245,247,0.35)" }} />
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText weight="500" style={{ fontSize: 15 }} numberOfLines={1}>
                    {ev.titulo}
                  </AppText>
                  <AppText style={{ fontSize: 12, color: colors.textTertiary }}>
                    {ev.materiaNombre} · {ev.tipoLabel}
                  </AppText>
                </View>
                <Pill
                  label={ev.estadoLabel}
                  mono
                  color={ev.grupo === "vencida" ? colors.dangerText : colors.warningText}
                  background={ev.grupo === "vencida" ? colors.dangerSoft : colors.warningSoft}
                  style={{ height: 22, paddingHorizontal: 9 }}
                />
              </View>
            ))}
          </View>
        )}
      />

      <Fab onPress={() => setSheetOpen(true)} />

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <AppText weight="600" style={{ fontSize: 19, letterSpacing: -0.1 }}>
          Nuevo evento
        </AppText>
        <TextInput
          value={titulo}
          onChangeText={setTitulo}
          placeholder="Título del evento"
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
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <Pill label="Contabilidad" color={colors.accentText} background={colors.accentSoft} style={{ height: 32, paddingHorizontal: 13 }} />
          <Pill label="Estadística" background={colors.surfaceSoft} style={{ height: 32, paddingHorizontal: 13 }} />
          <Pill label="Marketing" background={colors.surfaceSoft} style={{ height: 32, paddingHorizontal: 13 }} />
        </View>
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1, height: 48, borderRadius: radii.sm, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
            <AppText mono style={{ fontSize: 14 }}>
              mié 3 set
            </AppText>
          </View>
          <View style={{ flex: 1, height: 48, borderRadius: radii.sm, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
            <AppText mono style={{ fontSize: 14 }}>
              19:00
            </AppText>
          </View>
        </View>
        <View style={{ flexDirection: "row", gap: spacing.smd, paddingTop: spacing.xs }}>
          <PrimaryButton label="Cancelar" variant="ghost" flex onPress={() => setSheetOpen(false)} />
          <PrimaryButton label="Crear" flex onPress={() => setSheetOpen(false)} />
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}
