import { useEffect, useState } from "react";
import { FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import type { Semestre } from "@/types/database";
import { colors, radii, spacing } from "@/theme/tokens";
import { AppText, BackButton, PressableScale } from "@/components/ui";

export default function SemestreActivoScreen() {
  const [semestres, setSemestres] = useState<Semestre[]>([]);

  useEffect(() => {
    supabase
      .from("semestres")
      .select("*")
      .then(({ data }) => setSemestres(data ?? []));
  }, []);

  const activarSemestre = async (id: string) => {
    // TODO: replicar la lógica de "semestre activo" que ya existe en la versión web
    // (probablemente actualizar un flag en la tabla semestres o en el perfil del usuario)
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <BackButton />
        <AppText weight="600" style={{ fontSize: 16 }}>
          Semestre activo
        </AppText>
      </View>
      <FlatList
        data={semestres}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: spacing.sm, gap: spacing.smd }}
        renderItem={({ item }) => (
          <PressableScale
            onPress={() => activarSemestre(item.id)}
            style={{
              backgroundColor: item.activo ? colors.accentSoft : colors.surface,
              borderRadius: radii.lg,
              padding: spacing.lg,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <AppText weight="600" style={{ fontSize: 16, color: item.activo ? colors.accentText : colors.text }}>
              {item.nombre}
            </AppText>
            {item.activo ? <AppText style={{ fontSize: 13, color: colors.accentText }}>Activo</AppText> : null}
          </PressableScale>
        )}
        ListEmptyComponent={
          <AppText style={{ fontSize: 14, color: colors.textTertiary, textAlign: "center", paddingTop: spacing.xxxl }}>
            No hay semestres cargados todavía.
          </AppText>
        }
      />
    </SafeAreaView>
  );
}
