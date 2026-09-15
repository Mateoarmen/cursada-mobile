import { useState } from "react";
import { TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { colors, radii, spacing } from "@/theme/tokens";
import { AppText, PrimaryButton } from "@/components/ui";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    // La navegación a (tabs) ocurre sola: RootLayout escucha el cambio de sesión.
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxl, alignItems: "center" }}>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.xxl - spacing.sm }}>
          <View style={{ width: 84, height: 84, alignItems: "center", justifyContent: "center" }}>
            <View
              style={{
                position: "absolute",
                width: 84,
                height: 84,
                borderRadius: 42,
                borderWidth: 6,
                borderColor: colors.accent,
              }}
            />
          </View>
          <View style={{ alignItems: "center", gap: spacing.sm }}>
            <AppText weight="700" style={{ fontSize: 34, letterSpacing: -0.6, color: colors.text }}>
              cursada
            </AppText>
            <AppText style={{ fontSize: 15, lineHeight: 22, color: colors.textSecondary, textAlign: "center", maxWidth: 260 }}>
              Notas, agenda y horario en un solo lugar.
            </AppText>
          </View>
        </View>

        <View style={{ width: "100%", gap: spacing.smd }}>
          <PrimaryButton label="Continuar con Apple" variant="light" />
          <PrimaryButton label="Continuar con Google" variant="outline" />

          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.smd, paddingVertical: spacing.sm - 2 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <AppText style={{ fontSize: 12, color: colors.textFaint }}>o con tu correo</AppText>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          <TextInput
            style={{
              height: 50,
              borderRadius: radii.sm,
              backgroundColor: colors.surface,
              paddingHorizontal: spacing.lg,
              fontSize: 15,
              color: colors.text,
              fontFamily: "InstrumentSans_400Regular",
            }}
            placeholder="Correo institucional"
            placeholderTextColor={colors.textFaint}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={{
              height: 50,
              borderRadius: radii.sm,
              backgroundColor: colors.surface,
              paddingHorizontal: spacing.lg,
              fontSize: 15,
              color: colors.text,
              fontFamily: "InstrumentSans_400Regular",
            }}
            placeholder="Contraseña"
            placeholderTextColor={colors.textFaint}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {error ? (
            <AppText style={{ fontSize: 13, color: colors.dangerText, textAlign: "center" }}>{error}</AppText>
          ) : null}

          <PrimaryButton label="Ingresar" onPress={handleLogin} style={{ marginTop: spacing.xs }} />

          <AppText style={{ fontSize: 13, color: colors.textTertiary, textAlign: "center", marginTop: spacing.xs }}>
            ¿No tenés cuenta? <AppText weight="600" style={{ fontSize: 13, color: colors.accentText }}>Crear una</AppText>
          </AppText>
        </View>
      </View>
    </SafeAreaView>
  );
}
