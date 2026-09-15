import { router } from "expo-router";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useSession } from "@/hooks/useSession";
import { colors, radii, spacing } from "@/theme/tokens";
import { AppText, Avatar, BackButton, PressableScale, PrimaryButton } from "@/components/ui";

function SettingsRow({
  label,
  value,
  onPress,
  last,
  toggle,
}: {
  label: string;
  value?: string;
  onPress?: () => void;
  last?: boolean;
  toggle?: boolean;
}) {
  return (
    <PressableScale
      scaleTo={0.98}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 15,
        paddingHorizontal: spacing.lg,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: colors.borderFaint,
      }}
    >
      <AppText weight="500" style={{ fontSize: 15 }}>
        {label}
      </AppText>
      {toggle ? (
        <View
          style={{
            width: 44,
            height: 26,
            borderRadius: radii.round,
            backgroundColor: colors.accent,
            padding: 2,
            justifyContent: "center",
          }}
        >
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, marginLeft: "auto" }} />
        </View>
      ) : (
        <AppText style={{ fontSize: 14, color: colors.textTertiary, fontFamily: value ? "JetBrainsMono_500Medium" : undefined }}>
          {value ?? "›"}
        </AppText>
      )}
    </PressableScale>
  );
}

export default function PerfilScreen() {
  const { session } = useSession();
  const email = session?.user?.email ?? "";
  const initial = email ? email[0]!.toUpperCase() : "?";

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "left", "right"]}>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.md, flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <BackButton />
        <AppText weight="600" style={{ fontSize: 16 }}>
          Perfil
        </AppText>
      </View>

      <View style={{ paddingHorizontal: spacing.xl, gap: spacing.xxl }}>
        <View style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.sm }}>
          <Avatar initial={initial} size={88} fontSize={32} />
          <View style={{ alignItems: "center", gap: spacing.xxs }}>
            <AppText weight="600" style={{ fontSize: 19 }}>
              {email || "Tu cuenta"}
            </AppText>
            <AppText style={{ fontSize: 13, color: colors.textTertiary }}>Cursada</AppText>
          </View>
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, overflow: "hidden" }}>
          <SettingsRow label="Semestre activo" onPress={() => router.push("/semestre-activo")} />
          <SettingsRow label="Notificaciones" toggle />
          <SettingsRow label="Apariencia" value="Oscuro" last />
        </View>

        <View style={{ backgroundColor: colors.surface, borderRadius: radii.lg, overflow: "hidden" }}>
          <SettingsRow label="Privacidad y datos" />
          <SettingsRow label="Ayuda" last />
        </View>

        <PrimaryButton label="Cerrar sesión" variant="danger" onPress={handleLogout} />
        <AppText style={{ fontSize: 12, color: colors.textGhost, textAlign: "center", fontFamily: "JetBrainsMono_500Medium" }}>
          cursada 0.1.0
        </AppText>
      </View>
    </SafeAreaView>
  );
}
