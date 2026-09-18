import { useEffect, useMemo, useState } from "react";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { radii, spacing } from "@/theme/tokens";
import { useTheme } from "@/theme/ThemeContext";
import { AppText, PrimaryButton } from "@/components/ui";
import { traducirErrorAuth } from "@/lib/authErrors";

function makeInputStyle(colors: ReturnType<typeof useTheme>["colors"]) {
  return {
    height: 50,
    borderRadius: radii.sm,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    fontSize: 15,
    color: colors.text,
    fontFamily: "InstrumentSans_400Regular",
  } as const;
}

// Pantalla destino del link de "recuperar contraseña" (cursada://reset-password).
// Supabase manda el token de recuperación en la URL del deep link (como
// query params o en el fragmento, según el flujo configurado en el
// proyecto) — acá se intenta levantar la sesión temporal que ese token
// habilita. Si el link no trae nada reconocible (pantalla abierta
// directamente, o el flujo del proyecto difiere), se avisa en vez de
// mostrar un formulario que no va a poder guardar nada.
export default function ResetPasswordScreen() {
  const { colors } = useTheme();
  const inputStyle = useMemo(() => makeInputStyle(colors), [colors]);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const url = await Linking.getInitialURL();
        if (!url) {
          setLinkError("Abrí esta pantalla desde el link que te mandamos por mail.");
          setReady(true);
          return;
        }
        const parsed = Linking.parse(url);
        const params = parsed.queryParams ?? {};
        const accessToken = (params.access_token as string) ?? null;
        const refreshToken = (params.refresh_token as string) ?? null;
        if (accessToken && refreshToken) {
          const { error: sessionErr } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (sessionErr) throw sessionErr;
        } else {
          // Ya había una sesión de recuperación activa (Supabase la deja
          // establecida al abrir el link en algunos flujos) — seguimos.
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            setLinkError("Ese link venció o ya se usó — pedí uno nuevo desde \"¿Olvidaste tu contraseña?\" en el login.");
          }
        }
      } catch (e) {
        setLinkError(traducirErrorAuth(e));
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    setError(null);
    if (password !== passwordConfirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña tiene que tener al menos 6 caracteres.");
      return;
    }
    setBusy(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) throw updErr;
      setDone(true);
      // La sesión de recuperación ya queda como una sesión normal y válida
      // después de este cambio — el gate de _layout.tsx lleva a la app sola.
      setTimeout(() => router.replace("/(tabs)"), 1200);
    } catch (e) {
      setError(traducirErrorAuth(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.xxl, gap: spacing.lg, flexGrow: 1, justifyContent: "center" }}>
          {!ready ? null : done ? (
            <View style={{ alignItems: "center", gap: spacing.md }}>
              <AppText weight="700" style={{ fontSize: 21 }}>
                ¡Listo!
              </AppText>
              <AppText style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center" }}>
                Tu contraseña quedó actualizada.
              </AppText>
            </View>
          ) : linkError ? (
            <View style={{ gap: spacing.md, alignItems: "center" }}>
              <AppText weight="700" style={{ fontSize: 19, textAlign: "center" }}>
                No se pudo abrir el link
              </AppText>
              <AppText style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 }}>{linkError}</AppText>
              <PrimaryButton label="Ir al login" onPress={() => router.replace("/login")} style={{ marginTop: spacing.sm }} />
            </View>
          ) : (
            <>
              <AppText weight="700" style={{ fontSize: 21 }}>
                Elegí una contraseña nueva
              </AppText>
              <AppText style={{ fontSize: 14, color: colors.textSecondary }}>Escribila dos veces para confirmar.</AppText>
              <TextInput
                style={inputStyle}
                placeholder="Contraseña nueva"
                placeholderTextColor={colors.textFaint}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
              <TextInput
                style={inputStyle}
                placeholder="Repetila"
                placeholderTextColor={colors.textFaint}
                secureTextEntry
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
              />
              {error ? <AppText style={{ fontSize: 13, color: colors.dangerText, textAlign: "center" }}>{error}</AppText> : null}
              <PrimaryButton label="Guardar contraseña" onPress={handleSubmit} disabled={busy} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
